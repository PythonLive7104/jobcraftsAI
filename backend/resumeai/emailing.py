import os
from typing import Optional, Tuple

import requests


def send_email_via_resend(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: str = "",
) -> Tuple[bool, Optional[str]]:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        return False, "RESEND_API_KEY is not configured."

    from_email = os.getenv("RESEND_FROM_EMAIL", "JobCrafts AI <onboarding@resend.dev>").strip()
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text.strip():
        payload["text"] = text

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post("https://api.resend.com/emails", json=payload, headers=headers, timeout=30)
    except requests.RequestException as exc:
        return False, f"Unable to reach Resend: {exc}"

    if response.status_code not in (200, 201):
        return False, response.text or "Resend email send failed."
    return True, None


def send_welcome_email(*, email: str, username: str) -> Tuple[bool, Optional[str]]:
    safe_name = username or "there"
    subject = "Welcome to JobCrafts AI"
    html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin:0 0 12px;">Welcome to JobCrafts AI, {safe_name}!</h2>
      <p style="margin:0 0 10px;">Your account has been created successfully.</p>
      <p style="margin:0 0 10px;">
        You can now upload your resume, run ATS optimizations, generate cover letters,
        and prepare for interviews with AI.
      </p>
      <p style="margin:0;">We are glad to have you onboard.</p>
    </div>
    """.strip()
    text = (
        f"Welcome to JobCrafts AI, {safe_name}! "
        "Your account has been created successfully."
    )
    return send_email_via_resend(to_email=email, subject=subject, html=html, text=text)
