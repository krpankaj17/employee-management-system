# src/core/permissions.py
from typing import cast
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from core import security
from repository import auth_repo
from models.user import User

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: extracts and validates the Bearer JWT token and returns the User."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = security.decode_token(credentials.credentials)
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
                detail="User account is deactivated",
            )

        return user

    except HTTPException:
        raise
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

        user_permissions = set(auth_repo.get_user_permissions(cast(int, current_user.user_id), db=db))
        if "role:manage" in user_permissions:
            return current_user

        candidates = {permission_name}
        if ":view" in permission_name:
            candidates.add(permission_name.replace(":view", ":read"))
        elif ":read" in permission_name:
            candidates.add(permission_name.replace(":read", ":view"))

        if user_permissions.intersection(candidates):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Missing required permission '{permission_name}'",
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
            detail=f"Access denied: Requires role '{role_name}'",
        )

    return role_checker

