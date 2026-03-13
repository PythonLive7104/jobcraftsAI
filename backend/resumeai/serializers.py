from rest_framework import serializers

from .models import CareerGapAnalysis, Feature, JobAnalysis, Portfolio, Resume, ResumeVersion, UserSubscription


class SubscriptionSerializer(serializers.ModelSerializer):
    limits = serializers.SerializerMethodField()
    usage = serializers.SerializerMethodField()
    plan_display = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = ["plan", "plan_display", "period_start", "expiry_date", "days_until_expiry", "limits", "usage"]

    def get_plan_display(self, obj):
        return obj.get_plan_display()

    def get_expiry_date(self, obj):
        d = obj.expiry_date()
        return d.isoformat() if d else None

    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()

    def get_limits(self, obj):
        obj.reset_if_new_month()
        return {
            "resumes": obj.limit_for(Feature.RESUME_UPLOAD),
            "ats": obj.limit_for(Feature.ATS_OPTIMIZE),
            "cover_letter": obj.limit_for(Feature.COVER_LETTER),
            "interview_prep": obj.limit_for(Feature.INTERVIEW_PREP),
            "linkedin": obj.limit_for(Feature.LINKEDIN),
            "career_gap": obj.limit_for(Feature.CAREER_GAP),
        }

    def get_usage(self, obj):
        obj.reset_if_new_month()
        return {
            "resumes": obj.uses_for(Feature.RESUME_UPLOAD),
            "ats": obj.ats_uses,
            "cover_letter": obj.cover_letter_uses,
            "interview_prep": obj.interview_prep_uses,
            "linkedin": obj.linkedin_uses,
            "career_gap": obj.career_gap_uses,
        }


class ResumeUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ["id", "original_file", "file_type", "filename", "parse_status", "created_at"]
        read_only_fields = ["id", "file_type", "filename", "parse_status", "created_at"]

    def validate_original_file(self, file_obj):
        name = (file_obj.name or "").lower()
        if not (name.endswith(".pdf") or name.endswith(".docx")):
            raise serializers.ValidationError("Only PDF or DOCX files are allowed.")
        if file_obj.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 10MB).")
        return file_obj


class ResumeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ["id", "filename", "file_type", "parse_status", "parse_error", "extracted_text", "created_at"]


class ResumeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ["id", "filename", "file_type", "parse_status", "created_at"]


class JobAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobAnalysis
        fields = ["id", "resume", "job_title", "job_description", "keywords", "match", "created_at"]
        read_only_fields = ["id", "keywords", "match", "created_at"]


class ResumeVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeVersion
        fields = ["id", "resume", "title", "target_role", "job_title", "optimized_text", "ats_score", "created_at"]
        read_only_fields = ["id", "created_at"]


class CareerGapAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerGapAnalysis
        fields = [
            "id",
            "target_role",
            "gap_reason",
            "gap_start",
            "gap_end",
            "what_you_did",
            "result",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = [
            "id",
            "slug",
            "name",
            "title",
            "location",
            "short_summary",
            "experience",
            "projects",
            "skills",
            "resume",
            "email",
            "linkedin_url",
            "github_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def validate_resume(self, value):
        if value is None:
            return value
        request = self.context.get("request")
        if request and value.user_id != request.user.id:
            raise serializers.ValidationError("Resume must belong to you.")
        return value

    def validate_experience(self, value):
        if not isinstance(value, list):
            return []
        out = []
        for item in value[:20]:
            if not isinstance(item, dict):
                continue
            job_role = str(item.get("job_role", "")).strip()
            achievements = item.get("achievements", [])
            if isinstance(achievements, list):
                achievements = [str(a).strip() for a in achievements[:15] if str(a).strip()]
            out.append({"job_role": job_role, "achievements": achievements})
        return out

    def validate_projects(self, value):
        if not isinstance(value, list):
            return []
        out = []
        for item in value[:15]:
            if not isinstance(item, dict):
                continue
            desc = str(item.get("description", "")).strip()
            link = str(item.get("link", "")).strip()
            out.append({"description": desc, "link": link})
        return out

    def validate_skills(self, value):
        if not isinstance(value, list):
            return []
        return [str(s).strip() for s in value[:50] if str(s).strip()]