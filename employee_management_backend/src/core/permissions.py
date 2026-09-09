import jwt
from typing import cast
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from core import security
from repository import auth_repo
from models.user import User

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: extracts and validates JWT from Authorization header or ?token= query parameter."""
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif "token" in request.query_params:
        raw_token = request.query_params.get("token")

    if not raw_token or not isinstance(raw_token, str) or raw_token.strip() in ("", "null", "undefined"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token in header or '?token=' query parameter.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clean_token = raw_token.strip()
    parts = clean_token.split(".")
    if len(parts) != 3 or not all(parts):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: Malformed token format (expected 3 dot-separated JWT segments)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = security.decode_token(clean_token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, access token required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        public_id = payload.get("sub")
        if not public_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing subject",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = auth_repo.get_user_by_public_id(public_id, db=db)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access not granted: Your user account is currently deactivated.",
            )

        return user

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_permission(permission_name: str):
    """Enforces that the current authenticated user has the specified granular permission or Admin role."""
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = auth_repo.get_user_roles(cast(int, current_user.user_id), db=db)
        if "Admin" in user_roles:
            return current_user

        candidates = {permission_name}
        if ":view" in permission_name:
            candidates.add(permission_name.replace(":view", ":read"))
        elif ":read" in permission_name:
            candidates.add(permission_name.replace(":read", ":view"))

        # Explicitly revoked for this user takes highest precedence
        revoked = set(getattr(current_user, "revoked_permissions_list", []))
        if revoked.intersection(candidates):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access not granted: Permission '{permission_name}' has been specifically revoked for your user account.",
            )

        # Explicitly granted custom permission to this user
        custom = set(getattr(current_user, "custom_permissions_list", []))
        if custom.intersection(candidates):
            return current_user

        user_permissions = set(auth_repo.get_user_permissions(cast(int, current_user.user_id), db=db))
        if "role:manage" in user_permissions and "role:manage" not in revoked:
            return current_user

        if user_permissions.intersection(candidates):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access not granted: You do not have permission to perform this action (requires '{permission_name}').",
        )

    return permission_checker


def require_role(role_name: str):
    """Enforces that the current authenticated user has the specified role."""
    def role_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = auth_repo.get_user_roles(cast(int, current_user.user_id), db=db)
        if "Admin" in user_roles or role_name in user_roles:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access not granted: You do not have permission to access this resource (requires role '{role_name}').",
        )

    return role_checker


def require_admin_or_hr():
    """Enforces that the current authenticated user has Admin or HR_Manager role or 'role:manage' permission."""
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = auth_repo.get_user_roles(cast(int, current_user.user_id), db=db)
        if "Admin" in user_roles or "HR_Manager" in user_roles:
            return current_user

        user_permissions = set(auth_repo.get_user_permissions(cast(int, current_user.user_id), db=db))
        if "role:manage" in user_permissions:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: This resource requires Admin or HR Manager permissions.",
        )

    return checker

