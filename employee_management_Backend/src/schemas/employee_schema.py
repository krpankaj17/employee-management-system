# employee_schema.py
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class EmployeeIn(BaseModel):
    """Input schema for creating/updating employees.
    All foreign-key references use public UUIDs — never internal integer IDs."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: str = Field(description="Format YYYY-MM-DD")
    gender: str = Field(
        default="male",
        description="Must be one of: male, female, other, prefer_not_to_say",
    )
    email: str = Field(max_length=255)
    phone: str = Field(max_length=15)
    joining_date: str = Field(description="Format YYYY-MM-DD")
    employee_status: str = Field(
        default="active",
        description="Must be one of: active, inactive, on_leave, terminated, resigned",
    )
    employment_type: str = Field(
        default="full_time",
        description="Must be one of: full_time, part_time, contract, intern",
    )
    department_public_id: str | None = Field(
        default=None, description="Department UUID (public_id)"
    )
    designation_public_id: str | None = Field(
        default=None, description="Designation UUID (public_id)"
    )
    reporting_manager_public_id: str | None = Field(
        default=None, description="Reporting Manager UUID (public_id)"
    )
    is_active: bool = Field(default=True)
    employee_code: str | None = Field(
        default=None,
        description="Optional employee code (e.g. EMP-1014). Auto-generated if omitted.",
    )


class EmployeeOut(BaseModel):
    """Output schema — exposes only public UUIDs, never internal integer IDs."""

    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_code: str
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    email: str
    phone: str
    joining_date: str
    employee_status: str
    employment_type: str
    department_public_id: str | None
    designation_public_id: str | None
    reporting_manager_public_id: str | None
    is_active: bool
    created_at: str
    updated_at: str

    @field_validator("public_id", "department_public_id", "designation_public_id", "reporting_manager_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator(
        "date_of_birth", "joining_date", "created_at", "updated_at", mode="before"
    )
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return str(value) if value is not None else ""


class PaginatedEmployees(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[EmployeeOut]


class DirectReports(BaseModel):
    manager_public_id: str
    count: int
    reports: list[EmployeeOut]
