from datetime import datetime
from typing import TYPE_CHECKING, cast
from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, Text, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.employee import Employee


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    secondary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    token_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    custom_permissions: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    revoked_permissions: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


    # Password reset
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_reset_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee: Mapped["Employee | None"] = relationship("Employee", back_populates="user", uselist=False)
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    roles = relationship("Role", secondary="user_roles", back_populates="users", viewonly=True)

    __table_args__ = (
        Index("idx_users_email_lower", func.lower(email)),
    )

    @property
    def id(self) -> int:
        return cast(int, self.user_id)

    @property
    def employee_public_id(self) -> str | None:
        if self.employee and hasattr(self.employee, "public_id"):
            return str(self.employee.public_id)
        return None

    @property
    def custom_permissions_list(self) -> list[str]:
        if not self.custom_permissions or str(self.custom_permissions).strip() in ("", "[]"):
            return []
        try:
            import json
            res = json.loads(self.custom_permissions)
            return res if isinstance(res, list) else []
        except Exception:
            return []

    @property
    def revoked_permissions_list(self) -> list[str]:
        if not self.revoked_permissions or str(self.revoked_permissions).strip() in ("", "[]"):
            return []
        try:
            import json
            res = json.loads(self.revoked_permissions)
            return res if isinstance(res, list) else []
        except Exception:
            return []

    def has_role(self, role_name: str) -> bool:
        """Checks if the user has a given role or is an Admin."""
        if not self.roles:
            return False
        for r in self.roles:
            if r.role_name in ("Admin", role_name):
                return True
        return False

    def has_permission(self, permission_name: str) -> bool:
        """Checks if the user holds a specific granular permission, role:manage, or is an Admin."""
        candidates = {permission_name}
        if ":view" in permission_name:
            candidates.add(permission_name.replace(":view", ":read"))
        elif ":read" in permission_name:
            candidates.add(permission_name.replace(":read", ":view"))

        # Explicitly revoked for this user takes precedence
        if set(self.revoked_permissions_list).intersection(candidates):
            return False

        # Explicitly granted to this user
        if set(self.custom_permissions_list).intersection(candidates):
            return True

        if not self.roles:
            return False

        for r in self.roles:
            if r.role_name == "Admin":
                return True
            for p in r.permissions:
                if p.permission_name == "role:manage" or p.permission_name in candidates:
                    return True
        return False

    def has_exact_permission(self, permission_name: str) -> bool:
        """Checks if user has the exact permission without :read/:view aliasing, or is Admin/role:manage."""
        if permission_name in self.revoked_permissions_list:
            return False
        if permission_name in self.custom_permissions_list:
            return True

        if not self.roles:
            return False
        for r in self.roles:
            if r.role_name == "Admin":
                return True
            for p in r.permissions:
                if p.permission_name in (permission_name, "role:manage"):
                    return True
        return False

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "email": self.email,
            "display_name": self.display_name,
            "secondary_email": self.secondary_email,
            "is_active": self.is_active,
            "employee_public_id": self.employee_public_id,
            "custom_permissions": self.custom_permissions_list,
            "revoked_permissions": self.revoked_permissions_list,
            "last_login": (
                self.last_login.isoformat()
                if self.last_login and hasattr(self.last_login, "isoformat")
                else None
            ),
        }


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), index=True
    )
    role_name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles", viewonly=True)
    users = relationship("User", secondary="user_roles", back_populates="roles", viewonly=True)

    __table_args__ = (
        Index("idx_roles_role_name_lower", func.lower(role_name)),
    )

    @property
    def id(self) -> int:
        return cast(int, self.role_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "role_name": self.role_name,
            "description": self.description,
            "permissions": [p.permission_name for p in self.permissions] if self.permissions else [],
        }


class Permission(Base):
    __tablename__ = "permissions"

    permission_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), index=True
    )
    permission_name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    roles = relationship("Role", secondary="role_permissions", back_populates="permissions", viewonly=True)

    __table_args__ = (
        Index("idx_permissions_name_lower", func.lower(permission_name)),
    )

    @property
    def id(self) -> int:
        return cast(int, self.permission_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "permission_name": self.permission_name,
            "description": self.description,
        }


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("roles.role_id", ondelete="CASCADE"), primary_key=True, index=True
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("permissions.permission_id", ondelete="CASCADE"), primary_key=True, index=True
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission")

    __table_args__ = (
        Index("idx_rp_role_perm", "role_id", "permission_id"),
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("roles.role_id", ondelete="CASCADE"), primary_key=True, index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    user = relationship("User", back_populates="user_roles")
    role = relationship("Role")

    __table_args__ = (
        Index("idx_ur_user_role", "user_id", "role_id"),
    )
