from rest_framework import serializers

from .models import CareerGapAnalysis, Feature, JobAnalysis, Resume, ResumeVersion, UserSubscription


class SubscriptionSerializer(serializers.ModelSerializer):
    limits = serializers.SerializerMethodField()
    usage = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = ["plan", "period_start", "limits", "usage"]

    def get_limits(self, obj):
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