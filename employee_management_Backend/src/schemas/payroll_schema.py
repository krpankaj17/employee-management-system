# src/schemas/payroll_schema.py
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


# --- Salary Component Schemas ---

class SalaryComponentIn(BaseModel):
    component_name: str = Field(
        min_length=1,
        max_length=100,
        description="Name of component e.g. Basic Allowance, HRA, Medical Allowance, PF, Professional Tax",
    )
    component_type: Literal["earning", "deduction"] = Field(
        description="'earning' or 'deduction'"
    )
    amount: Decimal = Field(
        ge=Decimal("0"),
        description="Monthly component amount in currency units",
    )


class SalaryComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    component_id: int
    component_name: str
    component_type: str
    amount: float

    @field_validator("amount", mode="before")
    @classmethod
    def format_amount(cls, value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value is not None else 0.0


# --- Salary Structure Schemas ---

class SalaryCreateIn(BaseModel):
    employee_public_id: str = Field(
        description="Public UUID of the employee"
    )
    basic_salary: Decimal = Field(
        ge=Decimal("0"),
        description="Base monthly fixed salary"
    )
    currency: str = Field(
        default="INR",
        min_length=3,
        max_length=3,
        description="3-letter currency code (e.g. INR, USD, EUR)",
    )
    effective_from: date = Field(
        description="Start date from which this salary revision is effective"
    )
    components: list[SalaryComponentIn] = Field(
        default_factory=list,
        description="List of additional monthly earnings and deduction components",
    )


class SalaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_public_id: str
    basic_salary: float
    net_salary: float
    currency: str
    effective_from: str
    effective_to: str | None = None
    components: list[SalaryComponentOut] = Field(default_factory=list)
    created_at: str

    @field_validator("public_id", "employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @field_validator("basic_salary", "net_salary", mode="before")
    @classmethod
    def format_decimal(cls, value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value is not None else 0.0

    @field_validator("effective_from", "effective_to", "created_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value)


class SalaryHistoryOut(BaseModel):
    employee_public_id: str
    employee_name: str
    employee_code: str
    active_salary: SalaryOut | None = None
    history: list[SalaryOut] = Field(default_factory=list)


# --- Bank Detail Schemas ---

class BankDetailIn(BaseModel):
    employee_public_id: str = Field(description="Public UUID of the employee")
    bank_name: str = Field(min_length=2, max_length=150, description="Full bank institution name")
    branch_name: str | None = Field(default=None, max_length=150, description="Branch location/name")
    account_number: str = Field(min_length=4, max_length=34, description="Bank account number")
    routing_code: str = Field(min_length=4, max_length=20, description="IFSC / SWIFT / Sort / Routing code")
    account_type: Literal["savings", "current"] = Field(default="savings", description="'savings' or 'current'")
    is_primary: bool = Field(default=True, description="Whether this is the employee's primary salary disbursement account")


class BankDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_public_id: str
    bank_name: str
    branch_name: str | None = None
    account_number: str
    routing_code: str
    account_type: str
    is_primary: bool
    created_at: str

    @field_validator("public_id", "employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @field_validator("created_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value) if value is not None else ""


# --- Payroll Processing & Run Schemas ---

class PayrollProcessIn(BaseModel):
    pay_period_start: date = Field(description="Start date of the pay cycle (e.g. 2026-08-01)")
    pay_period_end: date = Field(description="End date of the pay cycle (e.g. 2026-08-31)")
    employee_public_id: str | None = Field(
        default=None,
        description="Optional public UUID to process payroll for a single employee. If null, batches all active employees.",
    )


class PayrollRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_public_id: str
    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    designation_title: str | None = None
    pay_period_start: str
    pay_period_end: str
    gross_amount: float
    total_deductions: float
    net_paid: float
    payment_status: str
    payment_date: str | None = None
    payment_method: str | None = None
    transaction_ref: str | None = None
    created_at: str

    @field_validator("public_id", "employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @field_validator("gross_amount", "total_deductions", "net_paid", mode="before")
    @classmethod
    def format_decimal(cls, value: Any) -> float:
        if isinstance(value, Decimal):
            return float(value)
        return float(value) if value is not None else 0.0

    @field_validator("pay_period_start", "pay_period_end", "payment_date", "created_at", mode="before")
    @classmethod
    def format_dates(cls, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value)


class PayslipOut(BaseModel):
    payroll_public_id: str
    employee_public_id: str
    employee_name: str
    employee_code: str
    email: str
    department: str | None = None
    designation: str | None = None
    bank_account_masked: str | None = None
    bank_name: str | None = None
    pay_period_start: str
    pay_period_end: str
    days_in_period: int
    days_present: int
    days_half_day: int
    days_on_leave: int
    days_absent: int
    basic_salary: float
    earnings_breakdown: list[SalaryComponentOut] = Field(default_factory=list)
    deductions_breakdown: list[SalaryComponentOut] = Field(default_factory=list)
    gross_amount: float
    total_deductions: float
    net_paid: float
    payment_status: str
    payment_date: str | None = None
    payment_method: str | None = None
    transaction_ref: str | None = None
    created_at: str


class PayrollDisburseIn(BaseModel):
    payment_method: Literal["bank_transfer", "cheque", "cash"] = Field(
        default="bank_transfer",
        description="'bank_transfer', 'cheque', or 'cash'",
    )
    transaction_ref: str | None = Field(
        default=None,
        max_length=100,
        description="Bank transaction reference, UTR, or check number",
    )
    payment_date: date | None = Field(
        default=None,
        description="Date payment was completed. Defaults to current date if omitted.",
    )


class PaginatedPayrollRuns(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[PayrollRunOut]
