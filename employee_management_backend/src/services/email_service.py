# src/services/email_service.py
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from core.config import settings
import logging

logger = logging.getLogger("email_service")


def send_otp_email(to_email: str, otp_code: str, expires_in_seconds: int = 150) -> None:
    """Sends a responsive HTML email containing the 6-digit OTP code via SMTP.
    Raises Exception if SMTP delivery fails."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise ValueError("SMTP credentials are not configured in settings")

    minutes_str = f"{expires_in_seconds // 60}.{int((expires_in_seconds % 60) / 6)}" if expires_in_seconds % 60 != 0 else str(expires_in_seconds // 60)

    subject = f"{otp_code} is your email verification code"
    from_header = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#ffffff;">
              <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Datansh Employee Portal</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Secure Account Email Verification</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#cbd5e1;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#94a3b8;">
                Please use the One-Time Password (OTP) below to complete your email verification and proceed with account registration.
              </p>
              
              <!-- OTP Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center" style="background-color:#0f172a;border-radius:12px;border:2px dashed #4f46e5;padding:20px;">
                    <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#38bdf8;font-family:monospace;">{otp_code}</span>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert -->
              <div style="background-color:#451a03;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#fde68a;line-height:18px;">
                  ⏱️ <strong>Note:</strong> This verification code is valid for <strong>{minutes_str} minutes ({expires_in_seconds} seconds)</strong> only.
                </p>
              </div>

              <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">
                If you did not initiate this registration request, please disregard this email. No account will be created without this verification code.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                &copy; 2026 Datansh Solutions. All rights reserved. &bull; Automated System Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    text_content = (
        f"Your email verification code is: {otp_code}\n\n"
        f"This code will expire in {expires_in_seconds} seconds ({minutes_str} minutes).\n"
        "If you did not request this, please ignore this message."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        logger.info(f"Verification email successfully sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        raise e


def send_password_reset_otp_email(to_email: str, otp_code: str, expires_in_seconds: int = 150) -> None:
    """Sends a responsive HTML email containing the 6-digit password reset OTP code via SMTP."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise ValueError("SMTP credentials are not configured in settings")

    minutes_str = f"{expires_in_seconds // 60}.{int((expires_in_seconds % 60) / 6)}" if expires_in_seconds % 60 != 0 else str(expires_in_seconds // 60)

    subject = f"{otp_code} is your password reset verification code"
    from_header = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(135deg,#ef4444,#f97316);color:#ffffff;">
              <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Datansh Employee Portal</h1>
              <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Password Reset Request</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#cbd5e1;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#94a3b8;">
                We received a request to reset your password. Please use the One-Time Password (OTP) below to reset your account password.
              </p>
              
              <!-- OTP Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center" style="background-color:#0f172a;border-radius:12px;border:2px dashed #f97316;padding:20px;">
                    <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#fb923c;font-family:monospace;">{otp_code}</span>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert -->
              <div style="background-color:#451a03;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#fde68a;line-height:18px;">
                  ⏱️ <strong>Note:</strong> This password reset code is valid for <strong>{minutes_str} minutes ({expires_in_seconds} seconds)</strong> only.
                </p>
              </div>

              <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">
                If you did not request a password reset, please ignore this email and make sure your account credentials remain secure.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                &copy; 2026 Datansh Solutions. All rights reserved. &bull; Automated System Notification
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    text_content = (
        f"Your password reset verification code is: {otp_code}\n\n"
        f"This code will expire in {expires_in_seconds} seconds ({minutes_str} minutes).\n"
        "If you did not request this, please ignore this message."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        logger.info(f"Password reset email successfully sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {str(e)}")
        raise e


def send_password_changed_alert(to_email: str) -> None:
    """Sends a security alert email notifying the user that their password was updated and other sessions revoked."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(f"SMTP not configured. Simulating password changed alert to: {to_email}")
        return

    subject = "Security Alert: Your password was updated"
    from_header = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"

    html_content = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Updated</title></head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="padding:28px 32px;text-align:center;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;">
          <h1 style="margin:0;font-size:22px;font-weight:700;">Datansh Employee Portal</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">Security Alert: Password Updated</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#cbd5e1;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:22px;color:#94a3b8;">
            Your account password was successfully updated. All other active sessions and refresh tokens have been invalidated for security.
          </p>
          <div style="background-color:#451a03;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;color:#fde68a;line-height:18px;">
              ⚠️ <strong>Did not perform this action?</strong> If you did not make this change, please contact your company IT / HR administrator immediately.
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;">
          <p style="margin:0;font-size:12px;color:#64748b;">&copy; 2026 Datansh Solutions. Automated Security Notification</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    text_content = (
        "Security Alert: Your account password was successfully updated.\n\n"
        "All other active sessions and refresh tokens have been revoked.\n"
        "If you did not make this change, please contact your administrator immediately."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL or settings.SMTP_USER, [to_email], msg.as_string())
        logger.info(f"Password changed alert email successfully sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send password changed alert to {to_email}: {str(e)}")


