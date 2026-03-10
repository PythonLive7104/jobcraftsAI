# Generated manually for LinkedIn optimization history

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("resumeai", "0011_portfolio"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LinkedInOptimization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("target_role", models.CharField(max_length=180)),
                ("headlines", models.JSONField(default=list)),
                ("about_versions", models.JSONField(default=list)),
                ("experience_rewrites", models.JSONField(default=list)),
                ("recommended_skills", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="linkedin_optimizations", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
