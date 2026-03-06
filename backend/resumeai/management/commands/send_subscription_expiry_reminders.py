from django.core.management.base import BaseCommand
from django.utils import timezone

from resumeai.emailing import send_email_via_resend
from resumeai.models import Plan, UserSubscription


class Command(BaseCommand):
    help = "Send email reminders to paid users when subscription expires in less than 2 days."

    def handle(self, *args, **options):
        sent = 0
        failed = 0

        subscriptions = UserSubscription.objects.filter(plan__in=[Plan.STARTER, Plan.PRO]).select_related("user")
        for sub in subscriptions:
            sub.reset_if_new_month()
            days_left = sub.days_until_expiry()
            if days_left is None:
                continue
            if days_left < 0 or days_left > 2:
                continue
            if sub.expiry_reminder_sent_for_period == sub.period_start:
                continue

            user = sub.user
            if not user.email:
                continue

            expiry_date = sub.expiry_date()
            subject = "Your JobCrafts AI subscription expires soon"
            html = f"""
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
              <h2 style="margin:0 0 12px;">Subscription expiry reminder</h2>
              <p style="margin:0 0 10px;">Hello {user.get_username()},</p>
              <p style="margin:0 0 10px;">
                Your <strong>{sub.get_plan_display()}</strong> plan expires in <strong>{days_left} day(s)</strong>.
              </p>
              <p style="margin:0 0 10px;">Expiry date: <strong>{expiry_date}</strong></p>
              <p style="margin:0;">To avoid interruption, please renew your subscription from the pricing page.</p>
            </div>
            """.strip()
            text = (
                f"Hello {user.get_username()}, your {sub.get_plan_display()} subscription expires in "
                f"{days_left} day(s). Expiry date: {expiry_date}. Please renew from the pricing page."
            )

            ok, _ = send_email_via_resend(
                to_email=user.email,
                subject=subject,
                html=html,
                text=text,
            )
            if ok:
                sub.expiry_reminder_sent_for_period = sub.period_start
                sub.save(update_fields=["expiry_reminder_sent_for_period"])
                sent += 1
            else:
                failed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Subscription expiry reminder run complete. Sent: {sent}, Failed: {failed}"
            )
        )
