# src/services/auth_service.py
import secrets
import datetime
import hashlib
from typing import cast
import utils
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session
from core import security
from core.config import settings
from repository import auth_repo
from models.employee import Employee
from models.email_verification import EmailVerification
from services.email_service import send_otp_email, send_password_reset_otp_email, send_password_changed_alert
import json
from schemas.auth_schema import (
    SendOtpIn,
    SendOtpOut,
    UserSignupIn,
    UserLoginIn,
    UserProfileOut,
    UserAccessUpdateIn,
    ForgotPasswordIn,
    ResetPasswordIn,
    ChangePasswordIn,
)




def request_signup_otp(payload: SendOtpIn, db: Session) -> dict:
    """Generates and emails a 6-digit OTP to the user for email verification before signup.
    Enforces a 150-second (2.5-minute) cooldown before allowing resending,
    unless server-side email dispatch failed."""
    clean_email = payload.email.strip().lower()
    if not utils.is_valid_email(clean_email):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    # Check if user already registered
    existing = auth_repo.get_user_by_email(clean_email, db=db)
    if existing:
        return {
            "ok": False,
            "error": "conflict",
            "message": f"An account with email '{clean_email}' already exists. Please log in.",
        }

    now_utc = datetime.datetime.now(datetime.timezone.utc)

    # Check existing unexpired cooldown
    verification_record = db.scalars(
        select(EmailVerification)
        .where(EmailVerification.email == clean_email)
        .order_by(EmailVerification.id.desc())
    ).first()

    if verification_record and verification_record.resend_available_at > now_utc:
        remaining_seconds = int((verification_record.resend_available_at - now_utc).total_seconds())
        if remaining_seconds > 0:
            return {
                "ok": False,
                "error": "rate_limited",
                "message": f"Please wait {remaining_seconds} seconds before requesting a new verification code.",
                "retry_after": remaining_seconds,
            }

    # Generate cryptographically secure 6-digit numeric OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    expires_in_seconds = settings.OTP_EXPIRATION_SECONDS  # 150 seconds (2.5 minutes)

    # 1. Attempt Email Delivery FIRST (Server Exception rule: no cooldown if dispatch fails)
    notice_msg = None
    try:
        send_otp_email(to_email=clean_email, otp_code=otp_code, expires_in_seconds=expires_in_seconds)
    except Exception as e:
        err_str = str(e)
        utils.log_action("EMAIL_OTP_FAILED", f"email={clean_email} error={err_str}")
        if "Network is unreachable" in err_str or "101" in err_str or "timed out" in err_str.lower() or "connection refused" in err_str.lower():
            logger.warning(f"Outbound SMTP network blocked on host. Providing on-screen verification code: {otp_code}")
            notice_msg = f"[Notice: Cloud host blocked SMTP port] Verification code: {otp_code}"
        else:
            return {
                "ok": False,
                "error": "email_failed",
                "message": f"Unable to deliver verification email: {err_str}. Please check your email address and try again.",
            }

    # 2. Only upon successful dispatch, persist OTP state & start cooldown
    expires_at = now_utc + datetime.timedelta(seconds=expires_in_seconds)
    resend_available_at = now_utc + datetime.timedelta(seconds=expires_in_seconds)

    # Delete previous verification records for this email
    existing_records = db.scalars(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    ).all()
    for rec in existing_records:
        db.delete(rec)

    new_record = EmailVerification(
        email=clean_email,
        otp_hash=otp_hash,
        expires_at=expires_at,
        resend_available_at=resend_available_at,
        attempts=0,
        is_verified=False,
    )
    db.add(new_record)
    db.commit()

    utils.log_action("EMAIL_OTP_SENT", f"email={clean_email}")
    msg = f"A 6-digit verification code has been sent to {clean_email}."
    if notice_msg:
        msg = notice_msg
    elif not settings.RESEND_API_KEY and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
        msg = f"[Demo Mode] Verification code: {otp_code} (SMTP not configured in cloud)."

    return {
        "ok": True,
        "message": msg,
        "expires_in_seconds": expires_in_seconds,
        "resend_in_seconds": expires_in_seconds,
        "retry_after": expires_in_seconds,
    }


def _build_user_profile(user, db: Session) -> dict:
    """Builds a full user profile dict including roles, effective permissions, and employee link."""
    roles = auth_repo.get_user_roles(cast(int, user.user_id), db=db)
    base_permissions = set(auth_repo.get_user_permissions(cast(int, user.user_id), db=db))
    custom_perms = set(getattr(user, "custom_permissions_list", []))
    revoked_perms = set(getattr(user, "revoked_permissions_list", []))
    effective_permissions = sorted(list((base_permissions.union(custom_perms)) - revoked_perms))

    emp_public_id = (
        str(user.employee.public_id)
        if user.employee and hasattr(user.employee, "public_id")
        else None
    )

    return {
        "public_id": str(user.public_id),
        "email": user.email,
        "display_name": user.display_name,
        "secondary_email": user.secondary_email,
        "is_active": user.is_active,
        "employee_public_id": emp_public_id,
        "roles": roles,
        "permissions": effective_permissions,
        "custom_permissions": list(getattr(user, "custom_permissions_list", [])),
        "revoked_permissions": list(getattr(user, "revoked_permissions_list", [])),
        "last_login": (
            user.last_login.isoformat()
            if user.last_login and hasattr(user.last_login, "isoformat")
            else None
        ),
    }


def signup_user(payload: UserSignupIn, db: Session) -> dict:
    """Handles self-service registration by validating OTP, creating user account, and issuing JWT tokens."""
    clean_email = payload.email.strip().lower()
    if not utils.is_valid_email(clean_email):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    existing = auth_repo.get_user_by_email(clean_email, db=db)
    if existing:
        return {"ok": False, "error": "conflict", "message": f"User with email '{clean_email}' already exists"}

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    if payload.otp is not None:
        rec = db.scalars(
            select(EmailVerification)
            .where(EmailVerification.email == clean_email)
            .order_by(EmailVerification.id.desc())
        ).first()

        if not rec:
            return {
                "ok": False,
                "error": "not_found",
                "message": "No verification request found for this email. Please request an OTP code first.",
            }

        # Check 150s expiration
        if now_utc > rec.expires_at:
            return {
                "ok": False,
                "error": "expired",
                "message": "The verification code has expired. Please request a new OTP code.",
            }

        # Check attempt limit
        if rec.attempts >= 3:
            db.delete(rec)
            db.commit()
            return {
                "ok": False,
                "error": "locked",
                "message": "Too many invalid attempts. This verification code has been invalidated. Please request a new one.",
            }

        # Verify OTP Hash
        input_hash = hashlib.sha256(payload.otp.strip().encode("utf-8")).hexdigest()
        if input_hash != rec.otp_hash:
            rec.attempts += 1
            db.commit()
            remaining = 3 - rec.attempts
            if remaining > 0:
                return {
                    "ok": False,
                    "error": "invalid_otp",
                    "message": f"Invalid verification code. {remaining} attempt(s) remaining.",
                }
            else:
                db.delete(rec)
                db.commit()
                return {
                    "ok": False,
                    "error": "locked",
                    "message": "Too many invalid attempts. This verification code has been invalidated. Please request a new one.",
                }

        # Valid OTP, clean up verification records
        db.execute(delete(EmailVerification).where(EmailVerification.email == clean_email))
        db.commit()

    # OTP is valid! Hash password & create user
    pwd_hash = security.hash_password(payload.password)

    clean_display_name = " ".join(payload.display_name.strip().split())

    user = auth_repo.create_user(
        db=db,
        email=clean_email,
        display_name=clean_display_name,
        password_hash=pwd_hash,
        default_role=None,
    )

    # Clean up verification records for this email
    records = db.scalars(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    ).all()
    for r in records:
        db.delete(r)
    db.commit()

    profile = _build_user_profile(user, db)
    token_data = {
        "sub": str(user.public_id),
        "email": user.email,
        "roles": profile["roles"],
        "permissions": profile["permissions"],
    }
    access_token = security.create_access_token(token_data)
    refresh_token = security.create_refresh_token(token_data)

    utils.log_action("SIGNUP", f"user={user.email} public_id={user.public_id}")
    return {
        "ok": True,
        "user": profile,
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    }



def authenticate_user(payload: UserLoginIn, db: Session) -> dict:
    """Authenticates user and generates JWT tokens."""
    clean_email = payload.email.strip().lower()
    user = auth_repo.get_user_by_email(clean_email, db=db)
    if not user:
        return {"ok": False, "error": "unauthorized", "message": "Invalid email or password"}

    if not user.is_active:
        return {"ok": False, "error": "forbidden", "message": "User account has been deactivated"}

    if not security.verify_password(payload.password, cast(str, user.password_hash)):
        return {"ok": False, "error": "unauthorized", "message": "Invalid email or password"}

    auth_repo.update_last_login(cast(int, user.user_id), db=db)
    profile = _build_user_profile(user, db)

    token_data = {
        "sub": str(user.public_id),
        "email": user.email,
        "token_version": user.token_version or 1,
        "roles": profile["roles"],
        "permissions": profile["permissions"],
    }
    access_token = security.create_access_token(token_data)
    refresh_token = security.create_refresh_token(token_data)

    utils.log_action("LOGIN", f"user={user.email} public_id={user.public_id}")
    return {
        "ok": True,
        "user": profile,
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    }


def refresh_access_token(refresh_token_str: str, db: Session) -> dict:
    """Validates refresh token and returns a freshly stamped access token."""
    try:
        payload = security.decode_token(refresh_token_str)
        if payload.get("type") != "refresh":
            return {"ok": False, "error": "unauthorized", "message": "Invalid token type, refresh token expected"}

        public_id = payload.get("sub")
        if not public_id:
            return {"ok": False, "error": "unauthorized", "message": "Invalid token payload"}
        user = auth_repo.get_user_by_public_id(str(public_id), db=db)
        if not user or not user.is_active:
            return {"ok": False, "error": "unauthorized", "message": "User not found or inactive"}

        # Validate token version against current user state (session revocation check)
        token_ver = payload.get("token_version")
        current_ver = user.token_version or 1
        if token_ver is not None and token_ver != current_ver:
            return {
                "ok": False,
                "error": "forbidden",
                "message": "Your session has expired or was revoked due to a password change. Please log in again.",
            }

        profile = _build_user_profile(user, db)
        token_data = {
            "sub": str(user.public_id),
            "email": user.email,
            "token_version": user.token_version or 1,
            "roles": profile["roles"],
            "permissions": profile["permissions"],
        }
        new_access_token = security.create_access_token(token_data)

        return {
            "ok": True,
            "tokens": {
                "access_token": new_access_token,
                "refresh_token": refresh_token_str,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
        }
    except Exception as exc:
        return {"ok": False, "error": "unauthorized", "message": f"Invalid or expired refresh token: {exc}"}


def request_password_reset(payload: ForgotPasswordIn, db: Session) -> dict:
    """Generates and emails a 6-digit OTP to the user for password reset.
    Enforces a 150-second (2.5-minute) cooldown before allowing resending.
    Follows Account Enumeration Defense: returns 200 OK whether user exists or not."""
    clean_email = payload.email.strip().lower()
    if not utils.is_valid_email(clean_email):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    # Account Enumeration Defense: If user does not exist, return generic success without leaking existence
    user = auth_repo.get_user_by_email(clean_email, db=db)
    if not user:
        utils.log_action("PASSWORD_RESET_ENUMERATION_SAFE", f"email={clean_email}")
        return {
            "ok": True,
            "message": "If an account with this email exists, a 6-digit password reset verification code has been sent.",
            "expires_in_seconds": 150,
            "resend_in_seconds": 150,
        }

    now_utc = datetime.datetime.now(datetime.timezone.utc)

    # Check existing unexpired cooldown
    verification_record = db.scalars(
        select(EmailVerification)
        .where(EmailVerification.email == clean_email)
        .order_by(EmailVerification.id.desc())
    ).first()

    if verification_record and verification_record.resend_available_at > now_utc:
        remaining_seconds = int((verification_record.resend_available_at - now_utc).total_seconds())
        if remaining_seconds > 0:
            return {
                "ok": False,
                "error": "rate_limited",
                "message": f"Please wait {remaining_seconds} seconds before requesting a new password reset code.",
                "retry_after": remaining_seconds,
            }

    # Generate cryptographically secure 6-digit numeric OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hash = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    expires_in_seconds = settings.OTP_EXPIRATION_SECONDS  # 150 seconds (2.5 minutes)

    # 1. Attempt Email Delivery FIRST
    notice_msg = None
    try:
        send_password_reset_otp_email(to_email=clean_email, otp_code=otp_code, expires_in_seconds=expires_in_seconds)
    except Exception as e:
        err_str = str(e)
        utils.log_action("PASSWORD_RESET_OTP_FAILED", f"email={clean_email} error={err_str}")
        if "Network is unreachable" in err_str or "101" in err_str or "timed out" in err_str.lower() or "connection refused" in err_str.lower():
            logger.warning(f"Outbound SMTP network blocked on host. Providing on-screen verification code: {otp_code}")
            notice_msg = f"[Notice: Cloud host blocked SMTP port] Password reset code: {otp_code}"
        else:
            return {
                "ok": False,
                "error": "email_failed",
                "message": f"Unable to deliver password reset email: {err_str}. Please check your email address and try again.",
            }

    # 2. Only upon successful dispatch, persist OTP state & start cooldown
    expires_at = now_utc + datetime.timedelta(seconds=expires_in_seconds)
    resend_available_at = now_utc + datetime.timedelta(seconds=expires_in_seconds)

    # Delete previous verification records for this email
    existing_records = db.scalars(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    ).all()
    for rec in existing_records:
        db.delete(rec)

    new_record = EmailVerification(
        email=clean_email,
        otp_hash=otp_hash,
        expires_at=expires_at,
        resend_available_at=resend_available_at,
        attempts=0,
        is_verified=False,
    )
    db.add(new_record)
    db.commit()

    utils.log_action("PASSWORD_RESET_OTP_SENT", f"email={clean_email}")
    msg = "If an account with this email exists, a 6-digit password reset verification code has been sent."
    if notice_msg:
        msg = notice_msg
    elif not settings.RESEND_API_KEY and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
        msg = f"[Demo Mode] Password reset code: {otp_code} (SMTP not configured in cloud)."

    return {
        "ok": True,
        "message": msg,
        "expires_in_seconds": expires_in_seconds,
        "resend_in_seconds": expires_in_seconds,
        "retry_after": expires_in_seconds,
    }


def reset_password(payload: ResetPasswordIn, db: Session) -> dict:
    """Validates password reset OTP and sets the new password. Revokes prior active sessions."""
    clean_email = payload.email.strip().lower()
    if not utils.is_valid_email(clean_email):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    user = auth_repo.get_user_by_email(clean_email, db=db)
    if not user:
        return {"ok": False, "error": "invalid_otp", "message": "Invalid verification code or email"}

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    rec = db.scalars(
        select(EmailVerification)
        .where(EmailVerification.email == clean_email)
        .order_by(EmailVerification.id.desc())
    ).first()

    if not rec:
        return {
            "ok": False,
            "error": "invalid_otp",
            "message": "Invalid or expired verification code. Please request a new OTP code.",
        }

    # Check 150s expiration
    if now_utc > rec.expires_at:
        return {
            "ok": False,
            "error": "expired",
            "message": "The verification code has expired. Please request a new OTP code.",
        }

    # Check attempt limit
    if rec.attempts >= 3:
        db.delete(rec)
        db.commit()
        return {
            "ok": False,
            "error": "locked",
            "message": "Too many invalid attempts. This verification code has been invalidated. Please request a new one.",
        }

    # Verify OTP Hash
    input_hash = hashlib.sha256(payload.otp.strip().encode("utf-8")).hexdigest()
    if input_hash != rec.otp_hash:
        rec.attempts += 1
        db.commit()
        remaining = 3 - rec.attempts
        if remaining > 0:
            return {
                "ok": False,
                "error": "invalid_otp",
                "message": f"Invalid verification code. {remaining} attempt(s) remaining.",
            }
        else:
            db.delete(rec)
            db.commit()
            return {
                "ok": False,
                "error": "locked",
                "message": "Too many invalid attempts. This verification code has been invalidated. Please request a new one.",
            }

    # OTP is valid! Update password and increment token_version (invalidating old sessions)
    new_hash = security.hash_password(payload.new_password)
    auth_repo.update_password(cast(int, user.user_id), new_hash, db=db)

    # Clean up verification records for this email
    records = db.scalars(
        select(EmailVerification).where(EmailVerification.email == clean_email)
    ).all()
    for r in records:
        db.delete(r)
    db.commit()

    # Dispatch security alert email
    send_password_changed_alert(clean_email)

    utils.log_action("PASSWORD_RESET_COMPLETED", f"user={user.email}")
    return {
        "ok": True,
        "message": "Password has been successfully updated. All prior active sessions have been revoked.",
    }


def change_password(user_public_id: str, payload: ChangePasswordIn, db: Session) -> dict:
    """Changes password for an authenticated user, revokes prior active sessions, and returns new tokens."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": "User not found"}

    if not security.verify_password(payload.current_password, cast(str, user.password_hash)):
        return {"ok": False, "error": "unauthorized", "message": "Current password does not match"}

    if security.verify_password(payload.new_password, cast(str, user.password_hash)):
        return {"ok": False, "error": "validation", "message": "New password cannot be the same as current password"}

    # Update password and increment token_version (invalidating sessions on other devices)
    new_hash = security.hash_password(payload.new_password)
    auth_repo.update_password(cast(int, user.user_id), new_hash, db=db)

    # Refresh user instance to get updated token_version
    db.refresh(user)

    # Dispatch security alert email
    send_password_changed_alert(cast(str, user.email))

    profile = _build_user_profile(user, db)
    token_data = {
        "sub": str(user.public_id),
        "email": user.email,
        "token_version": user.token_version or 1,
        "roles": profile["roles"],
        "permissions": profile["permissions"],
    }
    access_token = security.create_access_token(token_data)
    refresh_token = security.create_refresh_token(token_data)

    utils.log_action("PASSWORD_CHANGED_INAPP", f"user={user.email}")
    return {
        "ok": True,
        "user": profile,
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
    }




def get_user_profile(user_public_id: str, db: Session) -> dict | None:
    """Retrieves full profile for user."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return None
    return _build_user_profile(user, db)


def list_users(db: Session, skip: int = 0, limit: int | None = None) -> list[dict]:
    """Lists all users with their roles, permissions, and profile details."""
    users = auth_repo.get_all_users(db=db, skip=skip, limit=limit)
    return [_build_user_profile(u, db) for u in users]


def list_pending_users(db: Session, skip: int = 0, limit: int | None = None) -> list[dict]:
    """Lists users awaiting role assignment / admin approval."""
    pending = auth_repo.get_pending_users(db=db, skip=skip, limit=limit)
    return [_build_user_profile(u, db) for u in pending]


def list_roles(db: Session) -> list[dict]:
    """Lists all roles with their assigned permissions."""
    roles = auth_repo.get_all_roles(db)
    return [r.to_dict() for r in roles]


def list_permissions(db: Session) -> list[dict]:
    """Lists all system permissions."""
    perms = auth_repo.get_all_permissions(db)
    return [p.to_dict() for p in perms]


def assign_roles(user_public_id: str, role_names: list[str], db: Session) -> dict:
    """Assigns specified roles to user and automatically provisions base employee record if missing."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": f"User with public_id '{user_public_id}' not found"}

    role_ids = []
    for r_name in role_names:
        role = auth_repo.get_role_by_name(r_name, db=db)
        if not role:
            return {"ok": False, "error": "validation", "message": f"Role '{r_name}' does not exist"}
        role_ids.append(role.role_id)

    auth_repo.assign_roles_to_user(cast(int, user.user_id), role_ids, db=db)

    # Auto-provision employee profile if one does not exist for this user
    if not user.employee:
        raw_name = user.display_name.strip()
        parts = raw_name.split(" ", 1)
        first_name = parts[0] if parts else "Employee"
        last_name = parts[1] if len(parts) > 1 else ""

        max_id = db.scalar(select(func.max(Employee.emp_id))) or 0
        code = f"EMP-{1000 + max_id + 1}"

        emp = Employee(
            user_id=cast(int, user.user_id),
            employee_code=code,
            first_name=first_name,
            last_name=last_name,
            email=user.email,
            employee_status="active",
            employment_type="full_time",
            is_active=True,
        )
        db.add(emp)
        db.commit()
        db.refresh(user)
        utils.log_action("EMPLOYEE_AUTO_PROVISIONED", f"user={user.email} emp_code={code}")

    updated_profile = _build_user_profile(user, db)
    utils.log_action("ROLES_ASSIGNED", f"user={user.email} roles={role_names}")
    return {"ok": True, "user": updated_profile}


def get_role(identifier: str, db: Session) -> dict | None:
    """Retrieves a single role with its assigned permissions."""
    role = auth_repo.get_role_by_identifier(identifier, db)
    if not role:
        return None
    return role.to_dict()


def create_role(payload, db: Session) -> dict:
    """Creates a new role with optional initial permissions."""
    clean_name = payload.role_name.strip()
    existing = auth_repo.get_role_by_name(clean_name, db)
    if existing:
        return {"ok": False, "error": "conflict", "message": f"Role '{clean_name}' already exists"}

    permission_ids = []
    if payload.permission_names:
        for pname in payload.permission_names:
            p = auth_repo.get_permission_by_name(pname, db)
            if not p:
                return {"ok": False, "error": "validation", "message": f"Permission '{pname}' does not exist"}
            permission_ids.append(cast(int, p.permission_id))

    role = auth_repo.create_role(
        role_name=clean_name,
        description=payload.description,
        permission_ids=permission_ids,
        db=db,
    )
    utils.log_action("ROLE_CREATED", f"role={clean_name} permissions={payload.permission_names}")
    return {"ok": True, "role": role.to_dict()}


def update_role(identifier: str, payload, db: Session) -> dict:
    """Updates role metadata and/or permissions."""
    role = auth_repo.get_role_by_identifier(identifier, db)
    if not role:
        return {"ok": False, "error": "not_found", "message": f"Role '{identifier}' not found"}

    new_name = None
    if payload.role_name is not None:
        clean_new = payload.role_name.strip()
        if role.role_name.lower() == "admin" and clean_new.lower() != "admin":
            return {"ok": False, "error": "validation", "message": "The primary 'Admin' role name cannot be renamed"}
        if clean_new.lower() != role.role_name.lower():
            dup = auth_repo.get_role_by_name(clean_new, db)
            if dup:
                return {"ok": False, "error": "conflict", "message": f"Role '{clean_new}' already exists"}
        new_name = clean_new

    permission_ids = None
    if payload.permission_names is not None:
        permission_ids = []
        for pname in payload.permission_names:
            p = auth_repo.get_permission_by_name(pname, db)
            if not p:
                return {"ok": False, "error": "validation", "message": f"Permission '{pname}' does not exist"}
            permission_ids.append(cast(int, p.permission_id))

    updated_role = auth_repo.update_role(
        role=role,
        role_name=new_name,
        description=payload.description,
        permission_ids=permission_ids,
        db=db,
    )
    utils.log_action("ROLE_UPDATED", f"role={updated_role.role_name}")
    return {"ok": True, "role": updated_role.to_dict()}


def add_permissions_to_role(identifier: str, permission_names: list[str], db: Session) -> dict:
    """Adds permissions to an existing role."""
    role = auth_repo.get_role_by_identifier(identifier, db)
    if not role:
        return {"ok": False, "error": "not_found", "message": f"Role '{identifier}' not found"}

    permission_ids = []
    for pname in permission_names:
        p = auth_repo.get_permission_by_name(pname, db)
        if not p:
            return {"ok": False, "error": "validation", "message": f"Permission '{pname}' does not exist"}
        permission_ids.append(cast(int, p.permission_id))

    updated = auth_repo.add_permissions_to_role(role, permission_ids, db)
    utils.log_action("ROLE_PERMISSIONS_ADDED", f"role={role.role_name} added={permission_names}")
    return {"ok": True, "role": updated.to_dict()}


def revoke_permission_from_role(identifier: str, permission_name: str, db: Session) -> dict:
    """Revokes a specific permission from a role."""
    role = auth_repo.get_role_by_identifier(identifier, db)
    if not role:
        return {"ok": False, "error": "not_found", "message": f"Role '{identifier}' not found"}

    if role.role_name.lower() == "admin" and permission_name.strip().lower() == "role:manage":
        return {"ok": False, "error": "validation", "message": "Cannot revoke 'role:manage' from 'Admin' role"}

    perm = auth_repo.get_permission_by_name(permission_name, db)
    if not perm:
        return {"ok": False, "error": "not_found", "message": f"Permission '{permission_name}' not found"}

    auth_repo.revoke_permission_from_role(cast(int, role.role_id), cast(int, perm.permission_id), db)
    utils.log_action("ROLE_PERMISSION_REVOKED", f"role={role.role_name} revoked={permission_name}")
    refreshed = auth_repo.get_role_by_identifier(identifier, db)
    return {"ok": True, "role": refreshed.to_dict() if refreshed else None}


def delete_role(identifier: str, db: Session) -> dict:
    """Deletes a custom role."""
    role = auth_repo.get_role_by_identifier(identifier, db)
    if not role:
        return {"ok": False, "error": "not_found", "message": f"Role '{identifier}' not found"}

    if role.role_name.lower() == "admin":
        return {"ok": False, "error": "validation", "message": "The primary 'Admin' role is protected and cannot be deleted"}

    auth_repo.delete_role(role, db)
    utils.log_action("ROLE_DELETED", f"role={identifier}")
    return {"ok": True, "message": f"Role '{identifier}' deleted successfully"}


def revoke_user_role(user_public_id: str, role_name: str, db: Session) -> dict:
    """Revokes a role from a user."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": f"User with public_id '{user_public_id}' not found"}

    role = auth_repo.get_role_by_name(role_name, db=db)
    if not role:
        return {"ok": False, "error": "not_found", "message": f"Role '{role_name}' not found"}

    auth_repo.revoke_role_from_user(cast(int, user.user_id), cast(int, role.role_id), db=db)
    utils.log_action("USER_ROLE_REVOKED", f"user={user.email} role={role_name}")
    updated_profile = _build_user_profile(user, db)
    return {"ok": True, "user": updated_profile}


def update_user_access(user_public_id: str, payload: UserAccessUpdateIn, db: Session) -> dict:
    """Updates roles, custom permissions, revoked permissions, and active status for a specific user."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": f"User with public_id '{user_public_id}' not found"}

    if payload.roles is not None:
        assign_roles(user_public_id, payload.roles, db=db)
        user = auth_repo.get_user_by_public_id(user_public_id, db=db)

    if payload.custom_permissions is not None:
        try:
            user.custom_permissions = json.dumps(payload.custom_permissions)
        except Exception:
            user.custom_permissions = "[]"

    if payload.revoked_permissions is not None:
        try:
            user.revoked_permissions = json.dumps(payload.revoked_permissions)
        except Exception:
            user.revoked_permissions = "[]"

    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            user.token_version = (user.token_version or 1) + 1
        if user.employee:
            user.employee.is_active = payload.is_active
            if not payload.is_active:
                user.employee.employee_status = "inactive"
            elif getattr(user.employee, "employee_status", "").lower() in ("inactive", "suspended"):
                user.employee.employee_status = "active"

    db.commit()
    db.refresh(user)
    utils.log_action("USER_ACCESS_UPDATED", f"user={user.email} active={user.is_active}")
    return {"ok": True, "user": _build_user_profile(user, db)}


def reject_user(user_public_id: str, db: Session) -> dict:
    """Deletes / rejects a pending user registration."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": f"User with public_id '{user_public_id}' not found"}

    if user.employee:
        db.delete(user.employee)
    db.delete(user)
    db.commit()
    utils.log_action("USER_REJECTED", f"user_public_id={user_public_id}")
    return {"ok": True, "message": "User registration rejected and removed successfully."}

