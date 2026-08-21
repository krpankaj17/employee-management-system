# src/routes/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import get_current_user, require_permission
from models.user import User
from schemas.auth_schema import (
    UserSignupIn,
    UserLoginIn,
    TokenOut,
    TokenRefreshIn,
    UserProfileOut,
    ForgotPasswordIn,
    ResetPasswordIn,
    RoleOut,
    PermissionOut,
    RoleAssignIn,
)
from services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignupIn, db: Session = Depends(get_db)):
    """Self-service user registration. Automatically assigns default 'Employee' role."""
    result = auth_service.signup_user(payload, db=db)
    if not result["ok"]:
        code = 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
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


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Generates a secure password reset token."""
    return auth_service.request_password_reset(payload.email, db=db)


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    """Consumes password reset token and sets a new password."""
    result = auth_service.reset_password(payload.token, payload.new_password, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["message"])
    return result


@router.get("/roles", response_model=list[RoleOut], dependencies=[Depends(require_permission("role:manage"))])
def list_all_roles(db: Session = Depends(get_db)):
    """Lists all system roles and their assigned permissions. Requires 'role:manage' permission."""
    return auth_service.list_roles(db)


@router.get("/permissions", response_model=list[PermissionOut], dependencies=[Depends(require_permission("role:manage"))])
def list_all_permissions(db: Session = Depends(get_db)):
    """Lists all 41 granular system permissions. Requires 'role:manage' permission."""
    return auth_service.list_permissions(db)


@router.post("/users/{public_id}/roles", response_model=UserProfileOut, dependencies=[Depends(require_permission("role:manage"))])
def assign_user_roles(
    public_id: str,
    payload: RoleAssignIn,
    db: Session = Depends(get_db),
):
    """Assigns roles to a user. Requires 'role:manage' permission."""
    result = auth_service.assign_roles(public_id, payload.role_names, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["user"]
