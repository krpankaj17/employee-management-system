# src/schemas/employee_schema.py
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator
from schemas.address_schema import AddressIn, AddressOut, EmergencyContactIn, EmergencyContactOut


class EmployeeIn(BaseModel):
    """Input schema for creating/updating employees.
    All foreign-key references use public UUIDs — never internal integer IDs."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: str | None = Field(default=None, description="Format YYYY-MM-DD")
    gender: str | None = Field(
        default="male",
        description="Must be one of: male, female, other, prefer_not_to_say",
    )
    email: str = Field(max_length=255)
    phone: str | None = Field(default=None, max_length=15)
    joining_date: str | None = Field(default=None, description="Format YYYY-MM-DD")
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
    timezone: str | None = Field(default="UTC", description="Timezone e.g. Asia/Kolkata, America/New_York, UTC")
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
    date_of_birth: str | None = None
    gender: str | None = None
    email: str
    phone: str | None = None
    joining_date: str | None = None
    employee_status: str
    employment_type: str
    department_public_id: str | None = None
    department_name: str | None = None
    designation_public_id: str | None = None
    designation_name: str | None = None
    reporting_manager_public_id: str | None = None
    timezone: str | None = "UTC"
    is_active: bool

    @field_validator("public_id", "department_public_id", "designation_public_id", "reporting_manager_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("date_of_birth", "joining_date", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if str(value).strip() else None


class PaginatedEmployees(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[EmployeeOut]


class DirectReports(BaseModel):
    manager_public_id: str
    count: int
    reports: list[EmployeeOut]


# --- Composite Schemas for Admin Setup and Self-Service Onboarding ---

class AdminEmployeeSetupIn(BaseModel):
    """Single composite payload for HR/Admin to configure official corporate info,
    bank details, and optional salary/personal information in one request."""
    # Official Corporate Details
    department_public_id: str | None = Field(default=None, description="Department UUID")
    designation_public_id: str | None = Field(default=None, description="Designation UUID")
    reporting_manager_public_id: str | None = Field(default=None, description="Reporting Manager UUID")
    joining_date: str | None = Field(default=None, description="Format YYYY-MM-DD")
    employee_status: str = Field(default="active", description="active, inactive, on_leave, terminated, resigned")
    employment_type: str = Field(default="full_time", description="full_time, part_time, contract, intern")
    employee_code: str | None = Field(default=None, description="Optional custom code")
    timezone: str | None = Field(default="UTC", description="Timezone e.g. Asia/Kolkata, America/New_York, UTC")
    is_active: bool = Field(default=True)

    # Optional Bank Details
    bank_name: str | None = Field(default=None, max_length=150)
    branch_name: str | None = Field(default=None, max_length=150)
    account_number: str | None = Field(default=None, max_length=34)
    routing_code: str | None = Field(default=None, max_length=20)
    account_type: str | None = Field(default="savings")

    # Optional Salary Structure
    basic_salary: float | None = Field(default=None, ge=0)
    net_salary: float | None = Field(default=None, ge=0)
    currency: str = Field(default="INR", max_length=3)

    # Optional Personal Details / Addresses / Contacts if HR fills them
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    date_of_birth: str | None = Field(default=None, description="Format YYYY-MM-DD")
    gender: str | None = Field(default=None)
    phone: str | None = Field(default=None, max_length=15)
    secondary_email: str | None = Field(default=None, max_length=255)
    addresses: list[AddressIn] = Field(default_factory=list)
    emergency_contacts: list[EmergencyContactIn] = Field(default_factory=list)


class EmployeeProfileIn(BaseModel):
    """Single composite payload for employee self-service personal profile updates."""
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    date_of_birth: str | None = Field(default=None, description="Format YYYY-MM-DD")
    gender: str | None = Field(
        default=None,
        description="Must be one of: male, female, other, prefer_not_to_say",
    )
    phone: str | None = Field(default=None, max_length=15)
    secondary_email: str | None = Field(default=None, max_length=255)
    timezone: str | None = Field(default=None, description="Preferred timezone e.g. Asia/Kolkata, America/New_York, UTC")
    addresses: list[AddressIn] = Field(default_factory=list, description="Current & permanent addresses")
    emergency_contacts: list[EmergencyContactIn] = Field(default_factory=list, description="Emergency contacts list")


class EmployeeFullProfileOut(EmployeeOut):
    """Full employee profile including linked addresses and emergency contacts."""
    secondary_email: str | None = None
    addresses: list[AddressOut] = Field(default_factory=list)
    emergency_contacts: list[EmergencyContactOut] = Field(default_factory=list)
