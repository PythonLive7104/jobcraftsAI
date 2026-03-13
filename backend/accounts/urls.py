from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView

from .views import ForgotPasswordView, MeView, PublicTokenObtainPairView, RegisterView, ResendVerificationEmailView, ResetPasswordView, VerifyEmailView


class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


urlpatterns = [
    path("register/", csrf_exempt(RegisterView.as_view()), name="register"),
    path("login/", csrf_exempt(PublicTokenObtainPairView.as_view()), name="login"),
    path("refresh/", csrf_exempt(PublicTokenRefreshView.as_view()), name="token-refresh"),
    path("forgot-password/", csrf_exempt(ForgotPasswordView.as_view()), name="forgot-password"),
    path("reset-password/", csrf_exempt(ResetPasswordView.as_view()), name="reset-password"),
    path("verify-email/", csrf_exempt(VerifyEmailView.as_view()), name="verify-email"),
    path("resend-verification-email/", ResendVerificationEmailView.as_view(), name="resend-verification-email"),
    path("me/", MeView.as_view(), name="me"),
]
