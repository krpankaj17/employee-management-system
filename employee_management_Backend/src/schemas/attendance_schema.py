# src/schemas/attendance_schema.py
from datetime import datetime, date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class CheckInIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the active employee checking in")
    work_mode: str = Field(default="in_office", description="in_office | wfh | hybrid | field")
    notes: str | None = Field(default=None, description="Optional note for the shift")


class CheckOutIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the employee checking out")
    notes: str | None = Field(default=None, description="Optional checkout / handover note")


class ManualAttendanceIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the employee")
    date: str = Field(description="Format YYYY-MM-DD (past dates, or future dates if on_leave)")
    check_in: str | None = Field(default=None, description="Format HH:MM:SS or HH:MM")
    check_out: str | None = Field(default=None, description="Format HH:MM:SS or HH:MM")
    work_mode: str = Field(default="in_office", description="in_office | wfh | hybrid | field")
    status: str = Field(default="present", description="present | absent | half_day | late | on_leave")
    notes: str | None = None


class AttendanceUpdateIn(BaseModel):
    check_in: str | None = None
    check_out: str | None = None
    work_mode: str | None = None
    status: str | None = None
    notes: str | None = None


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str | None = None
    employee_public_id: str | None = None
    employee_id: int | None = None
    id: int | None = None
    date: str
    check_in: str | None = None
    check_out: str | None = None
    work_mode: str
    status: str
    total_hours: float = 0.0
    is_late: bool = False
    late_minutes: int = 0
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    @field_validator("public_id", "employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @field_validator("total_hours", mode="before")
    @classmethod
    def format_hours(cls, value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value is not None else 0.0

    @field_validator("date", "created_at", "updated_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class PaginatedAttendance(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[AttendanceOut]


class MonthlyBreakdownItem(BaseModel):
    month: int
    month_name: str
    days_present: int
    days_half_day: int
    days_on_leave: int
    days_absent: int
    total_hours_worked: float
    avg_daily_hours: float


class MonthlyAttendanceSummary(BaseModel):
    employee_id: int | None = None
    employee_public_id: str | None = None
    employee_name: str
    year: int
    month: int
    month_name: str
    days_in_month: int
    total_days_logged: int
    days_present: int
    days_half_day: int
    days_on_leave: int
    days_absent: int
    total_hours_worked: float
    avg_daily_hours: float
    records: list[AttendanceOut]


class YearlyAttendanceSummary(BaseModel):
    employee_id: int | None = None
    employee_public_id: str | None = None
    employee_name: str
    year: int
    total_days_present: int
    total_days_half_day: int
    total_days_on_leave: int
    total_days_absent: int
    total_annual_hours: float
    avg_monthly_hours: float
    monthly_breakdown: list[MonthlyBreakdownItem]


class HolidayIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    date: str = Field(description="Format YYYY-MM-DD")
    holiday_type: str = Field(default="company", description="national | regional | company | optional")
    year: int = Field(ge=2000, le=2100)
    is_optional: bool = Field(default=False)
    applicable_region: str = Field(default="ALL", max_length=100)


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    name: str
    date: str
    holiday_type: str
    year: int
    is_optional: bool
    applicable_region: str
    created_at: str

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @field_validator("date", "created_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


class PaginatedHolidays(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[HolidayOut]
