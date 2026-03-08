# Generated manually for Portfolio (Pro-only shareable portfolio)

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("resumeai", "0010_contactmessage_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Portfolio",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("title", models.CharField(blank=True, max_length=180)),
                ("location", models.CharField(blank=True, max_length=120)),
                ("short_summary", models.TextField(blank=True)),
                ("experience", models.JSONField(default=list)),
                ("projects", models.JSONField(default=list)),
                ("skills", models.JSONField(default=list)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("linkedin_url", models.URLField(blank=True)),
                ("github_url", models.URLField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("resume", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="portfolios_using", to="resumeai.resume")),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="portfolio", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
    ]
