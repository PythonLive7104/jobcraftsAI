from rest_framework.permissions import BasePermission

from .models import UserProfile


class IsEmailVerified(BasePermission):
    """
    Allow access only if the user has verified their email.
    Use together with IsAuthenticated.
    """

    message = "Please verify your email to use this feature."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        profile = UserProfile.get_or_create_profile(request.user)
        return profile.email_verified
