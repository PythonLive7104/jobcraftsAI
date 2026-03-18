import logging
from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)


def _sanitize_extracted_text(text: str) -> str:
    """Remove NUL chars that break PostgreSQL/JSON."""
    if not text:
        return text
    return text.replace("\x00", "")


@shared_task(bind=True, name="resumeai.parse_resume")
def parse_resume_task(self, resume_id: int) -> None:
    """
    Extract text from an uploaded resume (PDF or DOCX) and update the Resume record.
    Runs asynchronously in a Celery worker to avoid blocking the API.
    """
    from .models import Resume
    from .utils import extract_text_from_pdf, extract_text_from_docx

    try:
        resume = Resume.objects.get(id=resume_id)
    except ObjectDoesNotExist:
        logger.warning("parse_resume_task: Resume id=%s not found", resume_id)
        return

    if resume.parse_status != "processing":
        logger.info("parse_resume_task: Resume id=%s already %s, skipping", resume_id, resume.parse_status)
        return

    file_type = (resume.file_type or "pdf").lower()
    try:
        path = getattr(resume.original_file, "path", None)
        if path:
            if file_type == "pdf":
                text = extract_text_from_pdf(path)
            else:
                text = extract_text_from_docx(path)
        else:
            with resume.original_file.open("rb") as fp:
                if file_type == "pdf":
                    text = extract_text_from_pdf(fp)
                else:
                    text = extract_text_from_docx(fp)

        resume.extracted_text = _sanitize_extracted_text(text or "")
        resume.parse_status = "done"
        resume.save(update_fields=["extracted_text", "parse_status"])
        logger.info("parse_resume_task: Resume id=%s parsed successfully", resume_id)
    except Exception as e:
        resume.parse_status = "failed"
        resume.parse_error = str(e)
        resume.save(update_fields=["parse_status", "parse_error"])
        logger.exception("parse_resume_task: Resume id=%s failed: %s", resume_id, e)


@shared_task(bind=True, name="resumeai.job_analysis")
def job_analysis_task(self, user_id: int, resume_id: str, job_description: str, job_title: str) -> dict:
    from .models import JobAnalysis, Resume, UserSubscription
    from .ai import analyze_job_description_with_gpt5
    from .serializers import JobAnalysisSerializer

    resume = Resume.objects.get(id=resume_id, user_id=user_id)
    gpt_result = analyze_job_description_with_gpt5(
        resume_text=resume.extracted_text or "",
        job_description=job_description,
        job_title=job_title,
    )
    keywords = gpt_result.get("keywords") or {}
    match_data = gpt_result.get("match") or {}
    if not isinstance(keywords, dict):
        keywords = {}
    if not isinstance(match_data, dict):
        match_data = {}

    analysis = JobAnalysis.objects.create(
        resume=resume,
        job_title=job_title[:120] if job_title else "",
        job_description=job_description,
        keywords=keywords,
        match=match_data,
    )
    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    sub.reset_if_new_month()
    from .models import Feature
    sub.increment(Feature.ATS_OPTIMIZE)

    data = JobAnalysisSerializer(analysis).data
    data["usage"] = {
        "used": sub.uses_for(Feature.ATS_OPTIMIZE),
        "limit": sub.limit_for(Feature.ATS_OPTIMIZE),
    }
    return data


@shared_task(bind=True, name="resumeai.ats_optimize")
def ats_optimize_task(
    self, user_id: int, resume_id: str, job_description: str, target_role: str, job_title: str
) -> dict:
    from .models import Resume, ResumeVersion, UserSubscription
    from .ai import ats_optimize
    from .serializers import ResumeVersionSerializer

    resume = Resume.objects.get(id=resume_id, user_id=user_id)
    result = ats_optimize(
        resume_text=resume.extracted_text,
        job_description=job_description,
        target_role=target_role,
        job_title=job_title,
    )
    version = ResumeVersion.objects.create(
        resume=resume,
        title=f"ATS Optimized ({target_role or 'General'})",
        target_role=target_role,
        job_title=job_title,
        optimized_text=result["optimized_resume_text"],
        ats_score=int(result["score"]),
    )
    from .models import Feature
    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    sub.reset_if_new_month()
    sub.increment(Feature.ATS_OPTIMIZE)

    return {
        "resume_id": str(resume.id),
        "version": ResumeVersionSerializer(version).data,
        "ats": {
            "score": result["score"],
            "breakdown": result["breakdown"],
            "missing_keywords": result["missing_keywords"],
            "suggestions": result["suggestions"],
        },
    }


@shared_task(bind=True, name="resumeai.linkedin_optimize")
def linkedin_optimize_task(
    self, user_id: int, target_role: str, headline: str, about: str, experience: str
) -> dict:
    from .models import LinkedInOptimization, UserSubscription, UserActivity, UserActivityAction
    from .ai import linkedin_optimize

    result = linkedin_optimize(target_role, headline, about, experience)
    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    from .models import Feature
    sub.reset_if_new_month()
    sub.increment(Feature.LINKEDIN)
    UserActivity.objects.create(
        user_id=user_id,
        action=UserActivityAction.LINKEDIN,
        detail=target_role,
    )
    LinkedInOptimization.objects.create(
        user_id=user_id,
        target_role=target_role,
        headlines=result["headlines"],
        about_versions=result["about_versions"],
        experience_rewrites=result["experience_rewrites"],
        recommended_skills=result["recommended_skills"],
    )
    return {
        "target_role": target_role,
        "headlines": result["headlines"],
        "about_versions": result["about_versions"],
        "experience_rewrites": result["experience_rewrites"],
        "recommended_skills": result["recommended_skills"],
        "usage": {
            "used": sub.uses_for(Feature.LINKEDIN),
            "limit": sub.limit_for(Feature.LINKEDIN),
        },
    }


@shared_task(bind=True, name="resumeai.cover_letter")
def cover_letter_task(
    self,
    user_id: int,
    resume_id: str,
    company_name: str,
    job_title: str,
    tone: str,
    job_description: str,
) -> dict:
    from .models import Resume, UserSubscription, UserActivity, UserActivityAction
    from .ai import generate_cover_letter_with_gpt5

    resume = Resume.objects.get(id=resume_id, user_id=user_id)
    letter = generate_cover_letter_with_gpt5(
        resume_text=resume.extracted_text,
        company_name=company_name,
        job_title=job_title,
        tone=tone,
        job_description=job_description,
    )
    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    from .models import Feature
    sub.reset_if_new_month()
    sub.increment(Feature.COVER_LETTER)
    UserActivity.objects.create(
        user_id=user_id,
        action=UserActivityAction.COVER_LETTER,
        detail=f"{job_title} at {company_name}",
    )
    return {
        "resume_id": str(resume.id),
        "company_name": company_name,
        "job_title": job_title,
        "tone": tone,
        "cover_letter": letter,
        "usage": {
            "used": sub.uses_for(Feature.COVER_LETTER),
            "limit": sub.limit_for(Feature.COVER_LETTER),
        },
    }


@shared_task(bind=True, name="resumeai.interview_prep")
def interview_prep_task(
    self,
    user_id: int,
    resume_id: str,
    job_title: str,
    job_requirements: str,
    custom_questions: list,
) -> dict:
    from .models import Resume, UserSubscription, UserActivity, UserActivityAction
    from .ai import generate_interview_prep_with_gpt5, answer_custom_interview_questions

    resume = Resume.objects.get(id=resume_id, user_id=user_id)
    prep = generate_interview_prep_with_gpt5(
        resume_text=resume.extracted_text,
        job_title=job_title,
        job_requirements=job_requirements,
    )
    categories = list(prep.get("categories", []))
    if custom_questions:
        custom_answers = answer_custom_interview_questions(
            questions=custom_questions,
            resume_text=resume.extracted_text or "",
            job_title=job_title,
            job_requirements=job_requirements,
        )
        if custom_answers:
            categories.append({"category": "Your Questions", "questions": custom_answers})

    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    from .models import Feature
    sub.reset_if_new_month()
    sub.increment(Feature.INTERVIEW_PREP)
    UserActivity.objects.create(
        user_id=user_id,
        action=UserActivityAction.INTERVIEW_PREP,
        detail=job_title,
    )
    return {
        "resume_id": str(resume.id),
        "job_title": job_title,
        "categories": categories,
        "usage": {
            "used": sub.uses_for(Feature.INTERVIEW_PREP),
            "limit": sub.limit_for(Feature.INTERVIEW_PREP),
        },
    }


@shared_task(bind=True, name="resumeai.career_gap")
def career_gap_task(
    self,
    user_id: int,
    target_role: str,
    gap_reason: str,
    gap_start: str,
    gap_end: str,
    what_you_did: str,
) -> dict:
    from .models import CareerGapAnalysis, UserSubscription
    from .ai import career_gap_analyze
    from .serializers import CareerGapAnalysisSerializer

    result = career_gap_analyze(target_role, gap_reason, gap_start, gap_end, what_you_did)
    analysis = CareerGapAnalysis.objects.create(
        user_id=user_id,
        target_role=target_role,
        gap_reason=gap_reason,
        gap_start=gap_start,
        gap_end=gap_end,
        what_you_did=what_you_did,
        result=result,
    )
    sub, _ = UserSubscription.objects.get_or_create(user_id=user_id)
    from .models import Feature
    sub.reset_if_new_month()
    sub.increment(Feature.CAREER_GAP)

    payload = dict(result)
    payload["analysis"] = CareerGapAnalysisSerializer(analysis).data
    payload["usage"] = {
        "used": sub.uses_for(Feature.CAREER_GAP),
        "limit": sub.limit_for(Feature.CAREER_GAP),
    }
    return payload
