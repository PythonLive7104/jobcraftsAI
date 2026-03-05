from django.core.management.base import BaseCommand
from django.utils import timezone

from resumeai.models import EmailCampaign, EmailCampaignStatus


class Command(BaseCommand):
    help = "Send scheduled email campaigns that are due."

    def handle(self, *args, **options):
        due_campaigns = EmailCampaign.objects.filter(
            status=EmailCampaignStatus.SCHEDULED,
            scheduled_at__lte=timezone.now(),
        ).order_by("scheduled_at")

        if not due_campaigns.exists():
            self.stdout.write(self.style.SUCCESS("No due scheduled campaigns found."))
            return

        processed = 0
        total_sent = 0
        total_failed = 0

        for campaign in due_campaigns:
            try:
                campaign.send_campaign(force=True)
                processed += 1
                total_sent += campaign.sent_count
                total_failed += campaign.failed_count
            except Exception as exc:
                self.stderr.write(
                    self.style.WARNING(f"Campaign '{campaign.name}' failed: {exc}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {processed} campaign(s). Sent: {total_sent}, Failed: {total_failed}"
            )
        )
