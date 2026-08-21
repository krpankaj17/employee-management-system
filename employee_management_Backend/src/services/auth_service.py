# src/services/auth_service.py
import secrets
import datetime
import utils
from sqlalchemy.orm import Session
from core import security
from core.config import settings
from repository import auth_repo
from schemas.auth_schema import UserSignupIn, UserLoginIn, UserProfileOut


def _build_user_profile(user, db: Session) -> dict:
    """Builds a full user profile dict including roles, permissions, and employee link."""
    roles = auth_repo.get_user_roles(user.user_id, db=db)
    permissions = auth_repo.get_user_permissions(user.user_id, db=db)
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
        "permissions": permissions,
        "last_login": (
            user.last_login.isoformat()
            if user.last_login and hasattr(user.last_login, "isoformat")
            else None
        ),
        "created_at": (
            user.created_at.isoformat()
            if hasattr(user.created_at, "isoformat")
            else str(user.created_at)
        ),
        "updated_at": (
            user.updated_at.isoformat()
            if hasattr(user.updated_at, "isoformat")
            else str(user.updated_at)
        ),
    }


def signup_user(payload: UserSignupIn, db: Session) -> dict:
    """Handles self-service registration."""
    clean_email = payload.email.strip().lower()
    if not utils.is_valid_email(clean_email):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    existing = auth_repo.get_user_by_email(clean_email, db=db)
    if existing:
        return {"ok": False, "error": "conflict", "message": f"User with email '{clean_email}' already exists"}

    if payload.secondary_email:
        sec_email = payload.secondary_email.strip().lower()
        if sec_email == clean_email:
            return {"ok": False, "error": "validation", "message": "Secondary email cannot be the same as primary email"}

    # Hash password
    pwd_hash = security.hash_password(payload.password)

    user = auth_repo.create_user(
        db=db,
        email=clean_email,
        display_name=payload.display_name,
        password_hash=pwd_hash,
        secondary_email=payload.secondary_email,
    )

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

    if not security.verify_password(payload.password, user.password_hash):
        return {"ok": False, "error": "unauthorized", "message": "Invalid email or password"}

    auth_repo.update_last_login(user.user_id, db=db)
    profile = _build_user_profile(user, db)

    token_data = {
        "sub": str(user.public_id),
        "email": user.email,
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

        profile = _build_user_profile(user, db)
        token_data = {
            "sub": str(user.public_id),
            "email": user.email,
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


def request_password_reset(email: str, db: Session) -> dict:
    """Generates a password reset token."""
    clean_email = email.strip().lower()
    user = auth_repo.get_user_by_email(clean_email, db=db)
    if not user:
        # Return generic message to prevent email enumeration
        return {"ok": True, "message": "If this email is registered, a password reset link has been sent"}

    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    auth_repo.set_password_reset_token(user.user_id, reset_token, expires_at, db=db)

    utils.log_action("PASSWORD_RESET_REQUESTED", f"user={user.email}")
    return {
        "ok": True,
        "message": "Password reset token generated successfully",
        "reset_token": reset_token,
    }


def reset_password(token: str, new_password: str, db: Session) -> dict:
    """Consumes reset token and sets new password."""
    user = auth_repo.get_user_by_reset_token(token, db=db)
    if not user:
        return {"ok": False, "error": "validation", "message": "Invalid, expired, or previously used reset token"}

    new_hash = security.hash_password(new_password)
    auth_repo.update_password(user.user_id, new_hash, db=db)

    utils.log_action("PASSWORD_RESET_COMPLETED", f"user={user.email}")
    return {"ok": True, "message": "Password has been successfully updated"}


def get_user_profile(user_public_id: str, db: Session) -> dict | None:
    """Retrieves full profile for user."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return None
    return _build_user_profile(user, db)


def list_roles(db: Session) -> list[dict]:
    """Lists all roles with their assigned permissions."""
    roles = auth_repo.get_all_roles(db)
    return [r.to_dict() for r in roles]


def list_permissions(db: Session) -> list[dict]:
    """Lists all system permissions."""
    perms = auth_repo.get_all_permissions(db)
    return [p.to_dict() for p in perms]


def assign_roles(user_public_id: str, role_names: list[str], db: Session) -> dict:
    """Assigns specified roles to user."""
    user = auth_repo.get_user_by_public_id(user_public_id, db=db)
    if not user:
        return {"ok": False, "error": "not_found", "message": f"User with public_id '{user_public_id}' not found"}

    role_ids = []
    for r_name in role_names:
        role = auth_repo.get_role_by_name(r_name, db=db)
        if not role:
            return {"ok": False, "error": "validation", "message": f"Role '{r_name}' does not exist"}
        role_ids.append(role.role_id)

    auth_repo.assign_roles_to_user(user.user_id, role_ids, db=db)
    updated_profile = _build_user_profile(user, db)
    utils.log_action("ROLES_ASSIGNED", f"user={user.email} roles={role_names}")
    return {"ok": True, "user": updated_profile}
