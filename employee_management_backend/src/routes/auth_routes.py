# src/routes/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import get_current_user, require_permission, require_admin_or_hr
from models.user import User
from schemas.auth_schema import (
    SendOtpIn,
    SendOtpOut,
    UserSignupIn,
    UserLoginIn,
    TokenOut,
    TokenRefreshIn,
    UserProfileOut,
    PaginatedUsers,
    ForgotPasswordIn,
    ResetPasswordIn,
    RoleOut,
    PermissionOut,
    RoleAssignIn,
    RoleCreateIn,
    RoleUpdateIn,
    RolePermissionsIn,
    ChangePasswordIn,
    UserAccessUpdateIn,
)
from services import auth_service


router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])



@router.post("/send-otp", response_model=SendOtpOut, status_code=status.HTTP_200_OK)
def send_otp(payload: SendOtpIn, db: Session = Depends(get_db)):
    """Sends a 6-digit email verification OTP to the specified email address.
    Enforces a 150-second (2.5-minute) cooldown before allowing resending,
    unless server-side email dispatch failed."""
    result = auth_service.request_signup_otp(payload, db=db)
    if not result["ok"]:
        if result["error"] == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result["message"])
        elif result["error"] == "rate_limited":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=result["message"],
                headers={"Retry-After": str(result.get("retry_after", 150))},
            )
        elif result["error"] == "email_failed":
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result["message"])
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignupIn, db: Session = Depends(get_db)):
    """Self-service user registration with display_name, email, password, and the 6-digit email OTP."""
    result = auth_service.signup_user(payload, db=db)
    if not result["ok"]:
        if result["error"] == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result["message"])
        elif result["error"] == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["message"])
        elif result["error"] in ("expired", "locked", "invalid_otp", "validation"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result



@router.post("/login")
def login(payload: UserLoginIn, db: Session = Depends(get_db)):
    """Authenticates user with email & password, returns JWT tokens and granted permissions."""
    result = auth_service.authenticate_user(payload, db=db)
    if not result["ok"]:
        code = 403 if result["error"] == "forbidden" else 401
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/refresh", response_model=dict)
def refresh_token(payload: TokenRefreshIn, db: Session = Depends(get_db)):
    """Issues a new short-lived access token using a valid refresh token."""
    result = auth_service.refresh_access_token(payload.refresh_token, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=result["message"])
    return result["tokens"]


@router.get("/me", response_model=UserProfileOut)
def get_current_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns profile, roles, permissions, and linked employee UUID for the authenticated user."""
    profile = auth_service.get_user_profile(str(current_user.public_id), db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return profile


@router.post("/forgot-password", response_model=SendOtpOut, status_code=status.HTTP_200_OK)
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Sends a 6-digit password reset verification OTP to the specified email address.
    Enforces a 150-second cooldown before allowing resending. Follows Account Enumeration Defense."""
    result = auth_service.request_password_reset(payload, db=db)
    if not result["ok"]:
        if result["error"] == "rate_limited":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=result["message"],
                headers={"Retry-After": str(result.get("retry_after", 150))},
            )
        elif result["error"] == "email_failed":
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result["message"])
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    """Validates 6-digit password reset OTP and updates the user's password. Revokes prior active sessions."""
    result = auth_service.reset_password(payload, db=db)
    if not result["ok"]:
        if result["error"] in ("expired", "locked", "invalid_otp", "validation"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.post("/change-password", response_model=TokenOut)
def change_password(
    payload: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Changes password for an authenticated user, revokes prior active sessions, and returns new tokens."""
    result = auth_service.change_password(str(current_user.public_id), payload, db=db)
    if not result["ok"]:
        if result["error"] == "unauthorized":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
        elif result["error"] == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["message"])
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result




@router.get("/roles", response_model=list[RoleOut], dependencies=[Depends(require_permission("role:manage"))])
def list_all_roles(db: Session = Depends(get_db)):
    """Lists all system roles and their assigned permissions. Requires 'role:manage' permission."""
    return auth_service.list_roles(db)


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("role:manage"))])
def create_role(payload: RoleCreateIn, db: Session = Depends(get_db)):
    """Creates a new role with optional permission assignments. Requires 'role:manage' permission."""
    result = auth_service.create_role(payload, db=db)
    if not result["ok"]:
        code = 409 if result.get("error") == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["role"]


@router.get("/roles/{identifier}", response_model=RoleOut, dependencies=[Depends(require_permission("role:manage"))])
def get_role(identifier: str, db: Session = Depends(get_db)):
    """Retrieves role details and active permissions by role name or public UUID. Requires 'role:manage' permission."""
    role = auth_service.get_role(identifier, db=db)
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{identifier}' not found")
    return role


@router.put("/roles/{identifier}", response_model=RoleOut, dependencies=[Depends(require_permission("role:manage"))])
def update_role(identifier: str, payload: RoleUpdateIn, db: Session = Depends(get_db)):
    """Updates role metadata and/or assigned permissions. Requires 'role:manage' permission."""
    result = auth_service.update_role(identifier, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 409 if result.get("error") == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["role"]


@router.post("/roles/{identifier}/permissions", response_model=RoleOut, dependencies=[Depends(require_permission("role:manage"))])
def add_permissions_to_role(identifier: str, payload: RolePermissionsIn, db: Session = Depends(get_db)):
    """Adds one or more permissions to an existing role. Requires 'role:manage' permission."""
    result = auth_service.add_permissions_to_role(identifier, payload.permission_names, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["role"]


@router.delete("/roles/{identifier}/permissions/{permission_name}", response_model=RoleOut, dependencies=[Depends(require_permission("role:manage"))])
def revoke_permission_from_role(identifier: str, permission_name: str, db: Session = Depends(get_db)):
    """Revokes a specific permission from a role. Requires 'role:manage' permission."""
    result = auth_service.revoke_permission_from_role(identifier, permission_name, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["role"]


@router.delete("/roles/{identifier}", dependencies=[Depends(require_permission("role:manage"))])
def delete_role(identifier: str, db: Session = Depends(get_db)):
    """Deletes a custom role (built-in Admin role is protected). Requires 'role:manage' permission."""
    result = auth_service.delete_role(identifier, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return {"message": result["message"]}


@router.get("/permissions", response_model=list[PermissionOut], dependencies=[Depends(require_permission("role:manage"))])
def list_all_permissions(db: Session = Depends(get_db)):
    """Lists all 41 granular system permissions. Requires 'role:manage' permission."""
    return auth_service.list_permissions(db)


@router.get("/pending-users", response_model=PaginatedUsers, dependencies=[Depends(require_admin_or_hr())])
def get_pending_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Lists all users pending role assignment / admin approval. Accessible to Admin and HR Manager."""
    return auth_service.list_pending_users(db=db, skip=skip, limit=limit)


@router.get("/users", response_model=PaginatedUsers, dependencies=[Depends(require_admin_or_hr())])
def get_all_users(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Lists all registered users with their roles, permissions, and linked employee UUID. Accessible to Admin and HR Manager."""
    return auth_service.list_users(db=db, skip=skip, limit=limit)


@router.get("/users/{public_id}", response_model=UserProfileOut, dependencies=[Depends(require_admin_or_hr())])
def get_user_by_public_id(
    public_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves user profile by public UUID. Accessible to Admin and HR Manager."""
    profile = auth_service.get_user_profile(public_id, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail=f"User with public_id '{public_id}' not found")
    return profile


@router.post("/users/{public_id}/roles", response_model=UserProfileOut, dependencies=[Depends(require_admin_or_hr())])
def assign_user_roles(
    public_id: str,
    payload: RoleAssignIn,
    db: Session = Depends(get_db),
):
    """Assigns roles to a user and auto-provisions base employee profile if missing. Accessible to Admin and HR Manager."""
    result = auth_service.assign_roles(public_id, payload.role_names, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["user"]


@router.delete("/users/{public_id}/roles/{role_name}", response_model=UserProfileOut, dependencies=[Depends(require_permission("role:manage"))])
def revoke_user_role(
    public_id: str,
    role_name: str,
    db: Session = Depends(get_db),
):
    """Revokes a specific role from a user. Requires 'role:manage' permission."""
    result = auth_service.revoke_user_role(public_id, role_name, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["user"]


@router.put("/users/{public_id}/access", response_model=UserProfileOut, dependencies=[Depends(require_permission("role:manage"))])
def update_user_access(
    public_id: str,
    payload: UserAccessUpdateIn,
    db: Session = Depends(get_db),
):
    """Updates user roles, custom granted permissions, revoked permissions, and active status. Requires 'role:manage' permission."""
    result = auth_service.update_user_access(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["user"]


@router.delete("/users/{public_id}", dependencies=[Depends(require_admin_or_hr())])
@router.post("/users/{public_id}/reject", dependencies=[Depends(require_admin_or_hr())])
def reject_or_delete_user(
    public_id: str,
    db: Session = Depends(get_db),
):
    """Rejects / deletes an unapproved or removed user registration. Accessible to Admin and HR Manager."""
    result = auth_service.reject_user(public_id, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result

