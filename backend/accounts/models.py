import secrets

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=64, blank=True, db_index=True)

    def __str__(self):
        return f"Profile for {self.user.email}"

    @classmethod
    def get_or_create_profile(cls, user):
        profile, _ = cls.objects.get_or_create(user=user, defaults={"email_verified": False})
        return profile

    def generate_verification_token(self):
        self.verification_token = secrets.token_urlsafe(32)
        self.save(update_fields=["verification_token"])
        return self.verification_token
