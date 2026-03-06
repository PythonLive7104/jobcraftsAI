import json
from datetime import timedelta
import os
import uuid

from django.db.models import Avg
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from openai import OpenAIError
import requests

from .models import (
    ContactMessage,
    CareerGapAnalysis,
    Resume,
    ResumeVersion,
    JobAnalysis,
    Feature,
    Plan,
    PaymentStatus,
    PaymentTransaction,
    UserSubscription,
    UserActivity,
    UserActivityAction,
)
from .serializers import (
    ResumeUploadSerializer, ResumeDetailSerializer, ResumeListSerializer,
    JobAnalysisSerializer, ResumeVersionSerializer, SubscriptionSerializer, CareerGapAnalysisSerializer
)
from .permissions import HasFeatureAccess
from .utils import extract_text_from_pdf, extract_text_from_docx
from .ai import (
    analyze_job_description_with_gpt5,
    ats_optimize,
    generate_cover_letter_with_gpt5,
    generate_interview_prep_with_gpt5,
    linkedin_optimize,
    career_gap_analyze,
)
from .emailing import send_email_via_resend


class ContactMessageSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    message = serializers.CharField(max_length=5000)


class MeAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        return Response({
            "user": {"id": request.user.id, "email": request.user.email, "username": request.user.get_username()},
            "subscription": SubscriptionSerializer(sub).data
        })


class ContactUsAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        contact = ContactMessage.objects.create(
            name=payload["name"].strip(),
            email=payload["email"].strip(),
            message=payload["message"].strip(),
        )

        support_email = os.getenv("SUPPORT_EMAIL", "").strip() or os.getenv("RESEND_FROM_EMAIL", "").strip()
        if support_email:
            subject = f"New contact message from {contact.name}"
            html = f"""
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
              <h2 style="margin:0 0 12px;">New contact form message</h2>
              <p><strong>Name:</strong> {contact.name}</p>
              <p><strong>Email:</strong> {contact.email}</p>
              <p><strong>Message:</strong></p>
              <div style="white-space:pre-wrap;border:1px solid #ddd;padding:10px;border-radius:8px;">{contact.message}</div>
            </div>
            """.strip()
            text = f"Name: {contact.name}\nEmail: {contact.email}\n\n{contact.message}"
            send_email_via_resend(
                to_email=support_email,
                subject=subject,
                html=html,
                text=text,
            )

        return Response({"detail": "Message received. We will get back to you soon."}, status=status.HTTP_201_CREATED)


class PaymentInitializeAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        def _int_env(name: str, default: int) -> int:
            raw = os.getenv(name, "").strip()
            if not raw:
                return default
            try:
                parsed = int(raw)
                return parsed if parsed > 0 else default
            except ValueError:
                return default

        requested_plan = str(request.data.get("plan", "")).strip().lower()
        purchase_type = str(request.data.get("purchase_type", "")).strip().lower()
        is_credit_purchase = purchase_type == "credits"
        currency = os.getenv("PAYSTACK_CURRENCY", "USD").strip().upper() or "USD"
        if currency == "USD":
            starter_default = 500     # $5.00
            pro_default = 1200        # $12.00
            credit_default = 500      # $5.00
        else:
            # NGN in kobo (approx for $5 and $12; override in .env for your exact pricing)
            starter_default = 750000  # ₦7,500.00
            pro_default = 1800000     # ₦18,000.00
            credit_default = 750000   # ₦7,500.00
        plan_prices = {
            Plan.STARTER: _int_env("PAYSTACK_STARTER_AMOUNT_MINOR", starter_default),
            Plan.PRO: _int_env("PAYSTACK_PRO_AMOUNT_MINOR", pro_default),
        }
        if requested_plan not in plan_prices:
            return Response({"error": "Only starter or pro plans can be purchased."}, status=400)

        paystack_secret = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
        if not paystack_secret:
            return Response({"error": "PAYSTACK_SECRET_KEY is not configured."}, status=503)
        paystack_base_url = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co").rstrip("/")

        frontend_base_url = os.getenv("FRONTEND_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
        reference = f"resumeai-{request.user.id}-{uuid.uuid4().hex[:18]}"
        amount_cents = _int_env("PAYSTACK_CREDIT_AMOUNT_MINOR", credit_default) if is_credit_purchase else plan_prices[requested_plan]
        transaction_plan = Plan.FREE if is_credit_purchase else requested_plan
        email = (request.user.email or "").strip()
        if not email:
            return Response({"error": "Your account email is required for payment."}, status=400)

        PaymentTransaction.objects.create(
            user=request.user,
            reference=reference,
            plan=transaction_plan,
            amount_cents=amount_cents,
            currency=currency,
            status=PaymentStatus.PENDING,
        )

        payload = {
            "email": email,
            "amount": amount_cents,
            "currency": currency,
            "reference": reference,
            "metadata": {
                "user_id": request.user.id,
                "plan": requested_plan,
                "purchase_type": "credits" if is_credit_purchase else "plan_upgrade",
            },
        }
        if frontend_base_url.startswith("http://") or frontend_base_url.startswith("https://"):
            payload["callback_url"] = f"{frontend_base_url}/pricing"

        url = f"{paystack_base_url}/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {paystack_secret}",
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
        except requests.RequestException as exc:
            return Response({"error": f"Unable to reach Paystack right now: {exc}"}, status=502)

        if resp.status_code not in (200, 201):
            details = resp.text
            message = "Payment initialization failed"
            try:
                parsed = resp.json()
                message = parsed.get("message") or message
            except ValueError:
                pass
            return Response(
                {
                    "error": f"Paystack initialize failed: {message}",
                    "details": details,
                    "status_code": resp.status_code,
                },
                status=502,
            )

        body = resp.json()
        if not body.get("status"):
            return Response(
                {
                    "error": f"Paystack initialize failed: {body.get('message', 'Payment initialization failed.')}",
                    "details": body,
                },
                status=502,
            )

        data = body.get("data") or {}
        transaction = PaymentTransaction.objects.filter(reference=reference, user=request.user).first()
        if transaction:
            transaction.raw_response = body
            transaction.save(update_fields=["raw_response", "updated_at"])

        return Response(
            {
                "authorization_url": data.get("authorization_url"),
                "access_code": data.get("access_code"),
                "reference": data.get("reference") or reference,
            }
        )


class PaymentVerifyAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reference = str(request.query_params.get("reference", "")).strip()
        if not reference:
            return Response({"error": "reference is required"}, status=400)

        transaction = PaymentTransaction.objects.filter(reference=reference, user=request.user).first()
        if not transaction:
            return Response({"error": "Payment transaction not found."}, status=404)

        if transaction.status == PaymentStatus.SUCCESS:
            return Response(
                {
                    "status": "success",
                    "plan": transaction.plan,
                    "message": "Payment already verified.",
                }
            )

        paystack_secret = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
        if not paystack_secret:
            return Response({"error": "PAYSTACK_SECRET_KEY is not configured."}, status=503)
        paystack_base_url = os.getenv("PAYSTACK_BASE_URL", "https://api.paystack.co").rstrip("/")
        verify_url = f"{paystack_base_url}/transaction/verify/{reference}"
        headers = {"Authorization": f"Bearer {paystack_secret}"}
        try:
            resp = requests.get(verify_url, headers=headers, timeout=30)
        except requests.RequestException as exc:
            return Response({"error": f"Unable to verify payment right now: {exc}"}, status=502)

        if resp.status_code != 200:
            details = resp.text
            message = "Failed to verify payment."
            try:
                parsed = resp.json()
                message = parsed.get("message") or message
            except ValueError:
                pass
            transaction.status = PaymentStatus.FAILED
            transaction.save(update_fields=["status", "updated_at"])
            return Response(
                {"error": f"Paystack verify failed: {message}", "details": details, "status_code": resp.status_code},
                status=502,
            )

        body = resp.json()

        data = body.get("data") or {}
        paid = body.get("status") and data.get("status") == "success"
        amount_ok = int(data.get("amount") or 0) == int(transaction.amount_cents)
        currency_ok = str(data.get("currency") or "").upper() == str(transaction.currency).upper()
        metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
        purchase_type = str(metadata.get("purchase_type", "plan_upgrade")).strip().lower()
        plan_ok = True if purchase_type == "credits" else (str(metadata.get("plan", transaction.plan)).lower() == transaction.plan)

        if not (paid and amount_ok and currency_ok and plan_ok):
            transaction.status = PaymentStatus.FAILED
            transaction.raw_response = body
            transaction.save(update_fields=["status", "raw_response", "updated_at"])
            return Response({"error": "Payment verification failed validation checks."}, status=400)

        transaction.status = PaymentStatus.SUCCESS
        transaction.raw_response = body
        transaction.save(update_fields=["status", "raw_response", "updated_at"])

        if purchase_type == "credits":
            def _int_env(name: str, default: int) -> int:
                raw = os.getenv(name, "").strip()
                if not raw:
                    return default
                try:
                    parsed = int(raw)
                    return parsed if parsed > 0 else default
                except ValueError:
                    return default

            credits_per_pack = _int_env("ATS_CREDITS_PER_PACK", 30)
            sub, _ = UserSubscription.objects.get_or_create(user=request.user)
            sub.reset_if_new_month()
            sub.ats_bonus_credits += credits_per_pack
            sub.save(update_fields=["ats_bonus_credits"])

            return Response(
                {
                    "status": "success",
                    "purchase_type": "credits",
                    "credits_added": credits_per_pack,
                    "message": f"Credit purchase verified. {credits_per_pack} ATS credits added.",
                }
            )

        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.plan = transaction.plan
        sub.period_start = timezone.now().date()
        sub.save(update_fields=["plan", "period_start"])

        return Response(
            {
                "status": "success",
                "plan": transaction.plan,
                "message": f"Payment verified. Your plan is now {sub.get_plan_display()}.",
            }
        )


class PaymentHistoryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = PaymentTransaction.objects.filter(user=request.user).order_by("-created_at")[:50]

        def to_major(amount_minor: int, currency: str) -> str:
            code = (currency or "").upper()
            if code in {"JPY", "XOF", "XAF"}:
                return str(int(amount_minor))
            return f"{(amount_minor or 0) / 100:.2f}"

        items = [
            {
                "id": str(item.id),
                "reference": item.reference,
                "plan": item.plan,
                "amount_minor": item.amount_cents,
                "amount_major": to_major(item.amount_cents, item.currency),
                "currency": item.currency,
                "status": item.status,
                "created_at": item.created_at,
            }
            for item in transactions
        ]
        return Response({"count": len(items), "items": items})


class DashboardSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        sub, _ = UserSubscription.objects.get_or_create(user=user)
        sub.reset_if_new_month()

        resumes_created = Resume.objects.filter(user=user).count()
        avg_ats_score = (
            ResumeVersion.objects.filter(resume__user=user).aggregate(avg=Avg("ats_score")).get("avg") or 0
        )

        ats_limit = sub.limit_for(Feature.ATS_OPTIMIZE)
        ats_used = sub.uses_for(Feature.ATS_OPTIMIZE)
        credits_left = max(ats_limit - ats_used, 0)

        now = timezone.now()

        def relative_time(dt):
            if not dt:
                return "just now"
            delta = now - dt
            if delta < timedelta(minutes=1):
                return "just now"
            if delta < timedelta(hours=1):
                minutes = max(int(delta.total_seconds() // 60), 1)
                return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
            if delta < timedelta(days=1):
                hours = max(int(delta.total_seconds() // 3600), 1)
                return f"{hours} hour{'s' if hours != 1 else ''} ago"
            days = delta.days
            return f"{days} day{'s' if days != 1 else ''} ago"

        activity_events = []

        for version in ResumeVersion.objects.filter(resume__user=user).order_by("-created_at")[:5]:
            activity_events.append(
                {
                    "action": "Resume optimized",
                    "detail": version.job_title or version.target_role or version.title,
                    "time": relative_time(version.created_at),
                    "created_at": version.created_at,
                }
            )

        for analysis in JobAnalysis.objects.filter(resume__user=user).order_by("-created_at")[:5]:
            activity_events.append(
                {
                    "action": "Job analysis completed",
                    "detail": analysis.job_title or "Job description match",
                    "time": relative_time(analysis.created_at),
                    "created_at": analysis.created_at,
                }
            )

        for gap in CareerGapAnalysis.objects.filter(user=user).order_by("-created_at")[:5]:
            activity_events.append(
                {
                    "action": "Career gap analysis generated",
                    "detail": gap.target_role,
                    "time": relative_time(gap.created_at),
                    "created_at": gap.created_at,
                }
            )

        for activity in UserActivity.objects.filter(user=user).order_by("-created_at")[:10]:
            activity_events.append(
                {
                    "action": activity.get_action_display(),
                    "detail": activity.detail or "Completed",
                    "time": relative_time(activity.created_at),
                    "created_at": activity.created_at,
                }
            )

        activity_events.sort(key=lambda item: item["created_at"], reverse=True)
        recent_activity = [
            {"action": item["action"], "detail": item["detail"], "time": item["time"], "status": "completed"}
            for item in activity_events[:5]
        ]

        return Response(
            {
                "stats": {
                    "resumes_created": resumes_created,
                    "cover_letters": sub.uses_for(Feature.COVER_LETTER),
                    "avg_ats_score": int(round(float(avg_ats_score))) if avg_ats_score else 0,
                    "credits_left": credits_left,
                },
                "plan": {
                    "name": sub.get_plan_display(),
                    "ats_used": ats_used,
                    "ats_limit": ats_limit,
                    "ats_remaining": credits_left,
                },
                "recent_activity": recent_activity,
            }
        )


class ResumeUploadAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        resume_limit = sub.limit_for(Feature.RESUME_UPLOAD)
        resume_used = sub.uses_for(Feature.RESUME_UPLOAD)
        if resume_used >= resume_limit:
            return Response(
                {
                    "error": f"Resume upload limit reached for your {sub.plan} plan ({resume_used}/{resume_limit} this month).",
                    "code": "resume_upload_limit_reached",
                },
                status=403,
            )

        s = ResumeUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        f = s.validated_data["original_file"]
        name = (f.name or "")
        file_type = "pdf" if name.lower().endswith(".pdf") else "docx"

        resume = Resume.objects.create(
            user=request.user,
            original_file=f,
            file_type=file_type,
            filename=name,
            parse_status="processing",
        )

        # Sync parse for now (easy). Move to Celery later.
        try:
            path = resume.original_file.path
            if file_type == "pdf":
                text = extract_text_from_pdf(path)
            else:
                text = extract_text_from_docx(path)

            resume.extracted_text = text
            resume.parse_status = "done"
            resume.save(update_fields=["extracted_text", "parse_status"])
        except Exception as e:
            resume.parse_status = "failed"
            resume.parse_error = str(e)
            resume.save(update_fields=["parse_status", "parse_error"])

        payload = ResumeDetailSerializer(resume).data
        payload["resume_usage"] = {
            "used": sub.uses_for(Feature.RESUME_UPLOAD),
            "limit": resume_limit,
        }
        return Response(payload, status=201)


class ResumeListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        resumes = Resume.objects.filter(user=request.user).order_by("-created_at")
        return Response(
            {
                "count": resumes.count(),
                "items": ResumeListSerializer(resumes, many=True).data,
            }
        )


class ResumeDetailAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        return Response(ResumeDetailSerializer(resume).data)


class JobAnalysisAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        job_description = request.data.get("job_description", "").strip()
        job_title = request.data.get("job_title", "").strip()

        if not job_description:
            return Response({"error": "job_description is required"}, status=400)
        if resume.parse_status != "done":
            return Response({"error": "Resume not parsed yet"}, status=400)

        try:
            gpt_result = analyze_job_description_with_gpt5(
                resume_text=resume.extracted_text,
                job_description=job_description,
                job_title=job_title,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and model access."},
                status=502,
            )
        except json.JSONDecodeError:
            return Response({"error": "GPT analysis failed: invalid JSON response."}, status=502)

        analysis = JobAnalysis.objects.create(
            resume=resume,
            job_title=job_title,
            job_description=job_description,
            keywords=gpt_result["keywords"],
            match=gpt_result["match"],
        )
        return Response(JobAnalysisSerializer(analysis).data, status=201)


class ATSOptimizeAPI(APIView):
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.ATS_OPTIMIZE)]

    def post(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        if resume.parse_status != "done":
            return Response({"error": "Resume not parsed yet"}, status=400)

        job_description = request.data.get("job_description", "").strip()
        target_role = request.data.get("target_role", "").strip()
        job_title = request.data.get("job_title", "").strip()

        if not job_description:
            return Response({"error": "job_description is required"}, status=400)

        try:
            result = ats_optimize(
                resume_text=resume.extracted_text,
                job_description=job_description,
                target_role=target_role,
                job_title=job_title,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and ATS model access."},
                status=502,
            )
        except json.JSONDecodeError:
            return Response({"error": "GPT ATS optimization failed: invalid JSON response."}, status=502)

        version = ResumeVersion.objects.create(
            resume=resume,
            title=f"ATS Optimized ({target_role or 'General'})",
            target_role=target_role,
            job_title=job_title,
            optimized_text=result["optimized_resume_text"],
            ats_score=int(result["score"]),
        )

        # increment usage
        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        sub.increment(Feature.ATS_OPTIMIZE)

        return Response({
            "resume_id": str(resume.id),
            "version": ResumeVersionSerializer(version).data,
            "ats": {
                "score": result["score"],
                "breakdown": result["breakdown"],
                "missing_keywords": result["missing_keywords"],
                "suggestions": result["suggestions"],
            }
        }, status=200)


class LinkedInOptimizeAPI(APIView):
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.LINKEDIN)]

    def post(self, request):
        target_role = request.data.get("target_role", "").strip()
        headline = request.data.get("headline", "").strip()
        about = request.data.get("about", "").strip()
        experience = request.data.get("experience", "").strip()

        if not target_role:
            return Response({"error": "target_role is required"}, status=400)

        try:
            result = linkedin_optimize(target_role, headline, about, experience)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and LinkedIn model access."},
                status=502,
            )
        except json.JSONDecodeError:
            return Response({"error": "GPT LinkedIn optimization failed: invalid JSON response."}, status=502)

        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        sub.increment(Feature.LINKEDIN)
        UserActivity.objects.create(
            user=request.user,
            action=UserActivityAction.LINKEDIN,
            detail=target_role,
        )

        return Response({
            "target_role": target_role,
            "headlines": result["headlines"],
            "about_versions": result["about_versions"],
            "experience_rewrites": result["experience_rewrites"],
            "recommended_skills": result["recommended_skills"],
            "usage": {
                "used": sub.uses_for(Feature.LINKEDIN),
                "limit": sub.limit_for(Feature.LINKEDIN),
            },
        })


class CoverLetterAPI(APIView):
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.COVER_LETTER)]

    def post(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        if resume.parse_status != "done":
            return Response({"error": "Resume not parsed yet"}, status=400)

        company_name = request.data.get("company_name", "").strip()
        job_title = request.data.get("job_title", "").strip()
        tone = request.data.get("tone", "professional").strip() or "professional"
        job_description = request.data.get("job_description", "").strip()

        if not company_name:
            return Response({"error": "company_name is required"}, status=400)
        if not job_title:
            return Response({"error": "job_title is required"}, status=400)
        if not job_description:
            return Response({"error": "job_description is required"}, status=400)

        try:
            letter = generate_cover_letter_with_gpt5(
                resume_text=resume.extracted_text,
                company_name=company_name,
                job_title=job_title,
                tone=tone,
                job_description=job_description,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and cover letter model access."},
                status=502,
            )

        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        sub.increment(Feature.COVER_LETTER)
        UserActivity.objects.create(
            user=request.user,
            action=UserActivityAction.COVER_LETTER,
            detail=f"{job_title} at {company_name}",
        )

        return Response(
            {
                "resume_id": str(resume.id),
                "company_name": company_name,
                "job_title": job_title,
                "tone": tone,
                "cover_letter": letter,
                "usage": {
                    "used": sub.uses_for(Feature.COVER_LETTER),
                    "limit": sub.limit_for(Feature.COVER_LETTER),
                },
            },
            status=200,
        )


class InterviewPrepAPI(APIView):
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.INTERVIEW_PREP)]

    def post(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        if resume.parse_status != "done":
            return Response({"error": "Resume not parsed yet"}, status=400)

        job_title = request.data.get("job_title", "").strip()
        # Backward compatible: accept old `job_description` payload too.
        job_requirements = (
            request.data.get("job_requirements", "").strip()
            or request.data.get("job_description", "").strip()
        )

        if not job_title:
            return Response({"error": "job_title is required"}, status=400)

        try:
            prep = generate_interview_prep_with_gpt5(
                resume_text=resume.extracted_text,
                job_title=job_title,
                job_requirements=job_requirements,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and interview prep model access."},
                status=502,
            )
        except json.JSONDecodeError:
            return Response({"error": "GPT interview prep failed: invalid JSON response."}, status=502)

        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        sub.increment(Feature.INTERVIEW_PREP)
        UserActivity.objects.create(
            user=request.user,
            action=UserActivityAction.INTERVIEW_PREP,
            detail=job_title,
        )

        return Response(
            {
                "resume_id": str(resume.id),
                "job_title": job_title,
                "categories": prep["categories"],
                "usage": {
                    "used": sub.uses_for(Feature.INTERVIEW_PREP),
                    "limit": sub.limit_for(Feature.INTERVIEW_PREP),
                },
            },
            status=200,
        )


class CareerGapAPI(APIView):
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.CAREER_GAP)]

    def post(self, request):
        target_role = request.data.get("target_role", "").strip()
        gap_reason = request.data.get("gap_reason", "").strip()
        gap_start = request.data.get("gap_start", "").strip()
        gap_end = request.data.get("gap_end", "").strip()
        what_you_did = request.data.get("what_you_did", "").strip()

        if not (target_role and gap_reason and gap_start and gap_end):
            return Response({"error": "target_role, gap_reason, gap_start, gap_end are required"}, status=400)

        try:
            result = career_gap_analyze(target_role, gap_reason, gap_start, gap_end, what_you_did)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=503)
        except OpenAIError:
            return Response(
                {"error": "OpenAI request failed. Check OPENAI_API_KEY in backend/.env and career gap model access."},
                status=502,
            )
        except json.JSONDecodeError:
            return Response({"error": "GPT career gap analysis failed: invalid JSON response."}, status=502)

        analysis = CareerGapAnalysis.objects.create(
            user=request.user,
            target_role=target_role,
            gap_reason=gap_reason,
            gap_start=gap_start,
            gap_end=gap_end,
            what_you_did=what_you_did,
            result=result,
        )

        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        sub.increment(Feature.CAREER_GAP)

        payload = dict(result)
        payload["analysis"] = CareerGapAnalysisSerializer(analysis).data
        payload["usage"] = {
            "used": sub.uses_for(Feature.CAREER_GAP),
            "limit": sub.limit_for(Feature.CAREER_GAP),
        }
        return Response(payload)


class CareerGapHistoryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        analyses = CareerGapAnalysis.objects.filter(user=request.user).order_by("-created_at")[:25]
        return Response(
            {
                "count": analyses.count(),
                "items": CareerGapAnalysisSerializer(analyses, many=True).data,
            }
        )


class CareerGapHistoryDetailAPI(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, analysis_id):
        analysis = get_object_or_404(CareerGapAnalysis, id=analysis_id, user=request.user)
        analysis.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResumeVersionsListAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, resume_id):
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)
        versions = resume.versions.order_by("-created_at")
        return Response({
            "resume_id": str(resume.id),
            "versions": ResumeVersionSerializer(versions, many=True).data
        })


class ResumeVersionDetailAPI(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, version_id):
        v = get_object_or_404(ResumeVersion, id=version_id, resume__user=request.user)
        return Response(ResumeVersionSerializer(v).data)