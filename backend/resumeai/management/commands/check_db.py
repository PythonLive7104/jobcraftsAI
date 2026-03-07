"""Test database connection and print helpful errors for Linode/PostgreSQL."""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Test database connection (useful for debugging Linode PostgreSQL setup)"

    def handle(self, *args, **options):
        engine = connection.settings_dict.get("ENGINE", "")
        if "postgresql" in engine:
            self.stdout.write("Testing PostgreSQL connection...")
        else:
            self.stdout.write("Using SQLite (no PostgreSQL env vars set).")
            return

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            self.stdout.write(self.style.SUCCESS("Database connection OK."))
        except Exception as e:
            err = str(e)
            self.stdout.write(self.style.ERROR(f"Connection failed: {err}"))
            if "timeout" in err.lower() or "timed out" in err.lower():
                self.stdout.write("")
                self.stdout.write(
                    "Connection timeout usually means your IP is not in Linode Trusted Sources."
                )
                self.stdout.write("Fix: Linode Cloud Manager → Databases → Your DB → Access Controls")
                self.stdout.write("     Add your current IP address (or 0.0.0.0/0 for testing only).")
