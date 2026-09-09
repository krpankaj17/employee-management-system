# src/schemas/auth_schema.py
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class SendOtpIn(BaseModel):
    email: str = Field(min_length=5, max_length=255, description="Valid email address to receive verification OTP")


class SendOtpOut(BaseModel):
    message: str
    expires_in_seconds: int = 150
    resend_in_seconds: int = 150
    retry_after: int | None = None


class UserSignupIn(BaseModel):
    email: str = Field(min_length=5, max_length=255, description="Valid email address")
    display_name: str = Field(min_length=1, max_length=200, description="Full name of user")
    password: str = Field(min_length=6, max_length=128, description="Plaintext password")
    otp: str | None = Field(default=None, description="6-digit verification code received via email")



class UserLoginIn(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token TTL in seconds")


class TokenRefreshIn(BaseModel):
    refresh_token: str = Field(min_length=1)


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    email: str
    display_name: str
    secondary_email: str | None = None
    is_active: bool
    employee_public_id: str | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    custom_permissions: list[str] = Field(default_factory=list)
    revoked_permissions: list[str] = Field(default_factory=list)
    last_login: str | None = None

    @field_validator("public_id", "employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("last_login", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str | None:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value) if value is not None else None


class ForgotPasswordIn(BaseModel):
    email: str = Field(min_length=5, max_length=255, description="Valid email address to receive password reset OTP")


class ResetPasswordIn(BaseModel):
    email: str = Field(min_length=5, max_length=255, description="Valid email address")
    otp: str = Field(min_length=6, max_length=6, description="6-digit verification code received via email")
    new_password: str = Field(min_length=6, max_length=128, description="New plaintext password")


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, description="Current plaintext password")
    new_password: str = Field(min_length=6, max_length=128, description="New plaintext password")




class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    role_name: str
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    permission_name: str
    description: str | None = None

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""


class RoleAssignIn(BaseModel):
    role_names: list[str] = Field(min_length=1, description="List of role names to assign")


class RoleCreateIn(BaseModel):
    role_name: str = Field(min_length=1, max_length=50, description="Unique name of role")
    description: str | None = Field(None, max_length=255)
    permission_names: list[str] = Field(default_factory=list, description="List of permission names to attach")


class RoleUpdateIn(BaseModel):
    role_name: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = Field(None, max_length=255)
    permission_names: list[str] | None = Field(None, description="Updated list of permission names")


class RolePermissionsIn(BaseModel):
    permission_names: list[str] = Field(min_length=1, description="List of permission names to add")


class UserAccessUpdateIn(BaseModel):
    roles: list[str] | None = None
    custom_permissions: list[str] | None = None
    revoked_permissions: list[str] | None = None
    is_active: bool | None = None

