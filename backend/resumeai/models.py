import uuid
import os
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from .emailing import send_email_via_resend


class Plan(models.TextChoices):
    FREE = "free", "Free"
    STARTER = "starter", "Starter"
    PRO = "pro", "Pro"


class Feature(models.TextChoices):
    RESUME_UPLOAD = "resume_upload", "Resume Upload"
    ATS_OPTIMIZE = "ats_optimize", "ATS Optimize"
    COVER_LETTER = "cover_letter", "Cover Letter"
    INTERVIEW_PREP = "interview_prep", "Interview Prep"
    LINKEDIN = "linkedin", "LinkedIn"
    CAREER_GAP = "career_gap", "Career Gap"


class UserSubscription(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    period_start = models.DateField(default=timezone.now)
    ats_uses = models.PositiveIntegerField(default=0)
    ats_bonus_credits = models.PositiveIntegerField(default=0)
    cover_letter_uses = models.PositiveIntegerField(default=0)
    cover_letter_bonus_credits = models.PositiveIntegerField(default=0)
    interview_prep_uses = models.PositiveIntegerField(default=0)
    interview_prep_bonus_credits = models.PositiveIntegerField(default=0)
    linkedin_uses = models.PositiveIntegerField(default=0)
    career_gap_uses = models.PositiveIntegerField(default=0)
    resume_bonus_credits = models.PositiveIntegerField(default=0)
    expiry_reminder_sent_for_period = models.DateField(null=True, blank=True)

    def downgrade_if_expired(self):
        """After 30 days, downgrade paid plans to FREE and deduct all credits."""
        if self.plan == Plan.FREE:
            return
        today = timezone.now().date()
        expires_on = self.period_start + timedelta(days=30)
        if today <= expires_on:
            return
        self.plan = Plan.FREE
        self.period_start = today
        self.ats_uses = 0
        self.ats_bonus_credits = 0
        self.cover_letter_uses = 0
        self.cover_letter_bonus_credits = 0
        self.interview_prep_uses = 0
        self.interview_prep_bonus_credits = 0
        self.linkedin_uses = 0
        self.career_gap_uses = 0
        self.resume_bonus_credits = 0
        self.expiry_reminder_sent_for_period = None
        self.save(
            update_fields=[
                "plan", "period_start",
                "ats_uses", "ats_bonus_credits",
                "cover_letter_uses", "cover_letter_bonus_credits",
                "interview_prep_uses", "interview_prep_bonus_credits",
                "linkedin_uses", "career_gap_uses",
                "resume_bonus_credits",
                "expiry_reminder_sent_for_period",
            ]
        )

    def reset_if_new_month(self):
        self.downgrade_if_expired()
        today = timezone.now().date()
        if self.period_start.month != today.month or self.period_start.year != today.year:
            self.period_start = today
            self.ats_uses = 0
            # Do NOT reset ats_bonus_credits - purchased credits persist and should be added to, not replaced
            self.cover_letter_uses = 0
            self.interview_prep_uses = 0
            self.linkedin_uses = 0
            self.career_gap_uses = 0
            self.expiry_reminder_sent_for_period = None
            self.save(
                update_fields=[
                    "period_start",
                    "ats_uses",
                    "cover_letter_uses",
                    "interview_prep_uses",
                    "linkedin_uses",
                    "career_gap_uses",
                    "expiry_reminder_sent_for_period",
                ]
            )

    def expiry_date(self):
        if self.plan == Plan.FREE:
            return None
        return self.period_start + timedelta(days=30)

    def days_until_expiry(self):
        expires_on = self.expiry_date()
        if not expires_on:
            return None
        return (expires_on - timezone.now().date()).days

    def limit_for(self, feature: str) -> int:
        def _int_env(name: str, default: int) -> int:
            raw = os.getenv(name, "").strip()
            if not raw:
                return default
            try:
                value = int(raw)
                return value if value > 0 else default
            except ValueError:
                return default

        starter_feature_limit = 20
        pro_feature_limit = _int_env("PRO_FEATURE_LIMIT", 50)
        if self.plan == Plan.PRO:
            if feature == Feature.RESUME_UPLOAD:
                return pro_feature_limit + self.resume_bonus_credits
            if feature == Feature.ATS_OPTIMIZE:
                return pro_feature_limit + self.ats_bonus_credits
            if feature == Feature.COVER_LETTER:
                return pro_feature_limit + self.cover_letter_bonus_credits
            if feature == Feature.INTERVIEW_PREP:
                return pro_feature_limit + self.interview_prep_bonus_credits
            return pro_feature_limit
        if feature == Feature.RESUME_UPLOAD:
            if self.plan == Plan.STARTER:
                return starter_feature_limit + self.resume_bonus_credits
            if self.plan == Plan.FREE:
                return 1 + self.resume_bonus_credits
            return 1
        if feature == Feature.ATS_OPTIMIZE:
            if self.plan == Plan.FREE:
                return 1 + self.ats_bonus_credits
            if self.plan == Plan.STARTER:
                return starter_feature_limit + self.ats_bonus_credits
            return 3 + self.ats_bonus_credits
        if feature == Feature.COVER_LETTER:
            if self.plan == Plan.STARTER:
                return starter_feature_limit + self.cover_letter_bonus_credits
            if self.plan == Plan.FREE:
                return 1
            return 1
        if feature == Feature.INTERVIEW_PREP:
            if self.plan == Plan.STARTER:
                return starter_feature_limit + self.interview_prep_bonus_credits
            if self.plan == Plan.FREE:
                return 0
            return 2
        if feature == Feature.LINKEDIN:
            if self.plan == Plan.FREE:
                return 0
            return 3
        if feature == Feature.CAREER_GAP:
            if self.plan == Plan.FREE:
                return 0
            return 3
        return 0

    def uses_for(self, feature: str) -> int:
        if feature == Feature.RESUME_UPLOAD:
            from datetime import datetime, time as dt_time
            start_dt = datetime.combine(self.period_start, dt_time.min)
            if timezone.is_naive(start_dt):
                start_dt = timezone.make_aware(start_dt)
            return self.user.resumes.filter(created_at__gte=start_dt).count()
        if feature == Feature.ATS_OPTIMIZE:
            return self.ats_uses
        if feature == Feature.COVER_LETTER:
            return self.cover_letter_uses
        if feature == Feature.INTERVIEW_PREP:
            return self.interview_prep_uses
        if feature == Feature.LINKEDIN:
            return self.linkedin_uses
        if feature == Feature.CAREER_GAP:
            return self.career_gap_uses
        return 0

    def increment(self, feature: str):
        if feature == Feature.ATS_OPTIMIZE:
            self.ats_uses += 1
            self.save(update_fields=["ats_uses"])
        elif feature == Feature.COVER_LETTER:
            self.cover_letter_uses += 1
            self.save(update_fields=["cover_letter_uses"])
        elif feature == Feature.INTERVIEW_PREP:
            self.interview_prep_uses += 1
            self.save(update_fields=["interview_prep_uses"])
        elif feature == Feature.LINKEDIN:
            self.linkedin_uses += 1
            self.save(update_fields=["linkedin_uses"])
        elif feature == Feature.CAREER_GAP:
            self.career_gap_uses += 1
            self.save(update_fields=["career_gap_uses"])


class Resume(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="resumes")
    original_file = models.FileField(upload_to="resumes/original/")
    file_type = models.CharField(max_length=10)
    filename = models.CharField(max_length=255, blank=True)
    extracted_text = models.TextField(blank=True)
    parse_status = models.CharField(max_length=20, default="pending")
    parse_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ResumeVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name="versions")
    title = models.CharField(max_length=120, default="Optimized Version")
    target_role = models.CharField(max_length=120, blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    optimized_text = models.TextField()
    ats_score = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class JobAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name="job_analyses")
    job_title = models.CharField(max_length=120, blank=True)
    job_description = models.TextField()
    keywords = models.JSONField(default=dict)
    match = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class CareerGapAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="career_gap_analyses")
    target_role = models.CharField(max_length=180)
    gap_reason = models.CharField(max_length=180)
    gap_start = models.CharField(max_length=80)
    gap_end = models.CharField(max_length=80)
    what_you_did = models.TextField(blank=True)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class LinkedInOptimization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="linkedin_optimizations")
    target_role = models.CharField(max_length=180)
    headlines = models.JSONField(default=list)  # list of strings
    about_versions = models.JSONField(default=list)  # list of strings
    experience_rewrites = models.JSONField(default=list)  # list of {before, after}
    recommended_skills = models.JSONField(default=list)  # list of strings
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class UserActivityAction(models.TextChoices):
    COVER_LETTER = "cover_letter", "Cover letter generated"
    INTERVIEW_PREP = "interview_prep", "Interview prep generated"
    LINKEDIN = "linkedin", "LinkedIn optimization generated"


class UserActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activities")
    action = models.CharField(max_length=40, choices=UserActivityAction.choices)
    detail = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"


class PaymentTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_transactions")
    reference = models.CharField(max_length=80, unique=True)
    plan = models.CharField(max_length=20, choices=Plan.choices)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default="USD")
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class EmailAudience(models.TextChoices):
    ALL_USERS = "all_users", "All Users"
    FREE_USERS = "free_users", "Free Plan Users"
    PAID_USERS = "paid_users", "Paid Users (Starter/Pro)"


class EmailCampaignStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCHEDULED = "scheduled", "Scheduled"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class EmailCampaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=140)
    subject = models.CharField(max_length=255)
    html_content = models.TextField()
    text_content = models.TextField(blank=True)
    audience = models.CharField(max_length=20, choices=EmailAudience.choices, default=EmailAudience.ALL_USERS)
    is_promotional = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=EmailCampaignStatus.choices, default=EmailCampaignStatus.DRAFT)
    total_recipients = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_email_campaigns",
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def recipient_queryset(self):
        User = get_user_model()
        qs = User.objects.exclude(email__isnull=True).exclude(email__exact="")
        if self.audience == EmailAudience.FREE_USERS:
            return qs.filter(Q(subscription__isnull=True) | Q(subscription__plan=Plan.FREE)).distinct()
        if self.audience == EmailAudience.PAID_USERS:
            return qs.filter(subscription__plan__in=[Plan.STARTER, Plan.PRO]).distinct()
        return qs

    def send_campaign(self, actor=None, force=False):
        now = timezone.now()
        if self.scheduled_at and self.scheduled_at > now and not force:
            raise ValueError("Campaign is scheduled for a future time.")

        recipients = list(self.recipient_queryset().values_list("email", flat=True))
        self.status = EmailCampaignStatus.SENDING
        self.total_recipients = len(recipients)
        self.sent_count = 0
        self.failed_count = 0
        self.last_error = ""
        if actor and not self.created_by_id:
            self.created_by = actor
        self.save(
            update_fields=[
                "status",
                "total_recipients",
                "sent_count",
                "failed_count",
                "last_error",
                "created_by",
                "scheduled_at",
                "updated_at",
            ]
        )

        first_error = ""
        sent = 0
        failed = 0
        for email in recipients:
            ok, error = send_email_via_resend(
                to_email=email,
                subject=self.subject,
                html=self.html_content,
                text=self.text_content,
            )
            if ok:
                sent += 1
            else:
                failed += 1
                if not first_error:
                    first_error = error or "Unknown send error"

        self.sent_count = sent
        self.failed_count = failed
        self.last_error = first_error
        self.sent_at = timezone.now()
        self.status = EmailCampaignStatus.SENT if sent > 0 else EmailCampaignStatus.FAILED
        self.save(
            update_fields=[
                "sent_count",
                "failed_count",
                "last_error",
                "sent_at",
                "status",
                "updated_at",
            ]
        )

    def save(self, *args, **kwargs):
        if self.status in [EmailCampaignStatus.DRAFT, EmailCampaignStatus.SCHEDULED]:
            if self.scheduled_at and self.scheduled_at > timezone.now():
                self.status = EmailCampaignStatus.SCHEDULED
            elif self.status == EmailCampaignStatus.SCHEDULED:
                self.status = EmailCampaignStatus.DRAFT
        super().save(*args, **kwargs)


class ContactMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}>"


class Portfolio(models.Model):
    """Pro-only shareable portfolio page for recruiters."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="portfolio",
    )
    slug = models.SlugField(max_length=80, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    title = models.CharField(max_length=180, blank=True)
    location = models.CharField(max_length=120, blank=True)
    short_summary = models.TextField(blank=True)
    experience = models.JSONField(
        default=list,
        help_text="[{job_role, achievements: [str]}]",
    )
    projects = models.JSONField(
        default=list,
        help_text="[{description, link}]",
    )
    skills = models.JSONField(
        default=list,
        help_text="[str]",
    )
    resume = models.ForeignKey(
        Resume,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="portfolios_using",
    )
    email = models.EmailField(blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Portfolio: {self.name} ({self.slug})"