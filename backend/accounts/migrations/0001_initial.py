# Generated manually for UserProfile with email verification

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_profiles_for_existing_users(apps, schema_editor):
    """Create UserProfile for all existing users with email_verified=True so we don't lock them out."""
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    UserProfile = apps.get_model("accounts", "UserProfile")
    for user in User.objects.all():
        UserProfile.objects.get_or_create(user=user, defaults={"email_verified": True})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email_verified", models.BooleanField(default=False)),
                ("verification_token", models.CharField(blank=True, db_index=True, max_length=64)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RunPython(create_profiles_for_existing_users, reverse_code=noop),
    ]
