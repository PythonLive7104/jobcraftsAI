import logging
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ForgotPasswordRequestSerializer,
    PublicTokenObtainPairSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from resumeai.emailing import send_email_via_resend


User = get_user_model()
logger = logging.getLogger(__name__)


class PublicTokenObtainPairView(TokenObtainPairView):
    serializer_class = PublicTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        # Welcome email disabled for now; re-enable when Resend domain is verified
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserUpdateSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    def delete(self, request):
        request.user.delete()
        return Response({"detail": "Account deleted successfully."}, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            frontend_base = os.getenv("FRONTEND_BASE_URL", "http://127.0.0.1:5173").rstrip("/")
            reset_link = f"{frontend_base}/reset-password?uid={uid}&token={token}"

            html = f"""
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
              <h2 style="margin:0 0 12px;">Reset your JobCrafts AI password</h2>
              <p style="margin:0 0 10px;">We received a request to reset your password.</p>
              <p style="margin:0 0 16px;">
                <a href="{reset_link}" style="background:#4f46e5;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                  Reset Password
                </a>
              </p>
              <p style="margin:0 0 8px;">Or copy and paste this link into your browser:</p>
              <p style="margin:0;color:#4f46e5;word-break:break-all;">{reset_link}</p>
            </div>
            """.strip()
            text = f"Reset your password using this link: {reset_link}"

            ok, err = send_email_via_resend(
                to_email=user.email,
                subject="Reset your JobCrafts AI password",
                html=html,
                text=text,
            )
            if not ok:
                logger.warning("Password reset email failed for user %s: %s", user.id, err)

        return Response(
            {"detail": "If an account exists with that email, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data["uid"]
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Reset link is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password reset successful."}, status=status.HTTP_200_OK)
