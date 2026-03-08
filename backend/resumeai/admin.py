from django.contrib import admin
from django.contrib import messages
from django.http import HttpResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import ContactMessage, EmailCampaign, EmailCampaignStatus, Portfolio


@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "audience",
        "is_promotional",
        "status",
        "scheduled_at",
        "total_recipients",
        "sent_count",
        "failed_count",
        "preview_button",
        "sent_at",
        "created_at",
    )
    list_filter = ("audience", "is_promotional", "status", "created_at", "scheduled_at")
    search_fields = ("name", "subject")
    readonly_fields = (
        "preview_button",
        "status",
        "total_recipients",
        "sent_count",
        "failed_count",
        "last_error",
        "sent_at",
        "created_at",
        "updated_at",
    )
    actions = ["send_selected_campaigns", "send_due_campaigns"]

    fieldsets = (
        ("Campaign", {"fields": ("name", "subject", "audience", "is_promotional", "scheduled_at")}),
        ("Message", {"fields": ("html_content", "text_content")}),
        ("Preview", {"fields": ("preview_button",)}),
        (
            "Send Results",
            {
                "fields": (
                    "status",
                    "total_recipients",
                    "sent_count",
                    "failed_count",
                    "last_error",
                    "sent_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/preview/",
                self.admin_site.admin_view(self.preview_campaign_view),
                name="resumeai_emailcampaign_preview",
            )
        ]
        return custom_urls + urls

    def preview_button(self, obj):
        if not obj or not obj.pk:
            return "Save campaign to enable preview"
        url = reverse("admin:resumeai_emailcampaign_preview", args=[obj.pk])
        return format_html('<a class="button" href="{}" target="_blank">Preview HTML</a>', url)

    preview_button.short_description = "Preview"

    def preview_campaign_view(self, request, object_id):
        campaign = self.get_object(request, object_id)
        if not campaign:
            return HttpResponse("Campaign not found.", status=404)
        return HttpResponse(campaign.html_content or "", content_type="text/html")

    @admin.action(description="Send selected campaigns now")
    def send_selected_campaigns(self, request, queryset):
        total_sent = 0
        total_failed = 0
        for campaign in queryset:
            try:
                campaign.send_campaign(actor=request.user, force=True)
                total_sent += campaign.sent_count
                total_failed += campaign.failed_count
            except Exception as exc:
                total_failed += 1
                self.message_user(request, f"Failed to send {campaign.name}: {exc}", level=messages.WARNING)

        self.message_user(
            request,
            f"Campaign send complete. Sent: {total_sent}, Failed: {total_failed}",
            level=messages.INFO,
        )

    @admin.action(description="Send scheduled campaigns that are due")
    def send_due_campaigns(self, request, queryset):
        due = queryset.filter(
            status=EmailCampaignStatus.SCHEDULED,
            scheduled_at__lte=timezone.now(),
        )
        if not due.exists():
            self.message_user(request, "No due scheduled campaigns in selection.", level=messages.INFO)
            return

        total_sent = 0
        total_failed = 0
        for campaign in due:
            try:
                campaign.send_campaign(actor=request.user, force=True)
                total_sent += campaign.sent_count
                total_failed += campaign.failed_count
            except Exception as exc:
                total_failed += 1
                self.message_user(request, f"Failed to send {campaign.name}: {exc}", level=messages.WARNING)

        self.message_user(
            request,
            f"Due campaigns processed. Sent: {total_sent}, Failed: {total_failed}",
            level=messages.INFO,
        )


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "user", "updated_at")
    search_fields = ("name", "slug", "user__email")
    readonly_fields = ("id", "slug", "created_at", "updated_at")


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "created_at")
    search_fields = ("name", "email", "message")
    readonly_fields = ("name", "email", "message", "created_at")
    ordering = ("-created_at",)
