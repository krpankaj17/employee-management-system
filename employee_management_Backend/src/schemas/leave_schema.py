# src/schemas/leave_schema.py
from datetime import datetime, date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class LeaveTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    description: str | None = None
    max_days_per_year: int = Field(default=0, ge=0)
    is_paid: bool = Field(default=True)


class LeaveTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    name: str
    description: str | None = None
    max_days_per_year: int
    is_paid: bool
    created_at: str

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @field_validator("created_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class LeaveBalanceIn(BaseModel):
    employee_public_id: str
    leave_type_public_id: str
    year: int = Field(ge=2000, le=2100)
    total_allocated: int = Field(ge=0)


class LeaveBalanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    balance_id: int | None = None
    public_id: str | None = None
    employee_public_id: str | None = None
    leave_type_public_id: str | None = None
    employee_name: str | None = None
    leave_type_name: str | None = None
    year: int
    total_allocated: int
    used_leaves: int
    remaining_leaves: int
    updated_at: str | None = None

    @field_validator("public_id", "employee_public_id", "leave_type_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("updated_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class LeaveRequestIn(BaseModel):
    employee_public_id: str | None = Field(default=None, description="Optional target employee UUID (if manager submitting on behalf)")
    leave_type_public_id: str
    start_date: str = Field(description="Format YYYY-MM-DD")
    end_date: str = Field(description="Format YYYY-MM-DD")
    total_days: float = Field(gt=0, description="Total days requested e.g. 1.0 or 0.5")
    reason: str | None = None


class LeaveApprovalActionIn(BaseModel):
    action: str = Field(description="approved | rejected | escalated | cancelled")
    remarks: str | None = None
    rejection_reason: str | None = None


class LeaveHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: int
    action: str
    action_by_public_id: str | None = None
    action_by_name: str | None = None
    action_at: str
    remarks: str | None = None

    @field_validator("action_by_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("action_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_public_id: str | None = None
    employee_name: str | None = None
    leave_type_public_id: str | None = None
    leave_type_name: str | None = None
    start_date: str
    end_date: str
    total_days: float
    reason: str | None = None
    status: str
    approved_by_public_id: str | None = None
    rejection_reason: str | None = None
    created_at: str
    updated_at: str
    history: list[LeaveHistoryOut] = Field(default_factory=list)

    @field_validator("public_id", "employee_public_id", "leave_type_public_id", "approved_by_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("total_days", mode="before")
    @classmethod
    def format_decimal(cls, value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value is not None else 0.0

    @field_validator("start_date", "end_date", "created_at", "updated_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class PaginatedLeaveRequests(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[LeaveRequestOut]
