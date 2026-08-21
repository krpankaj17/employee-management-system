# src/models/payroll.py
from datetime import date, datetime
from decimal import Decimal
from typing import cast
from sqlalchemy import (
    BigInteger,
    String,
    Date,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Salary(Base):
    __tablename__ = "salaries"

    salary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    basic_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    net_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", back_populates="salaries")
    components = relationship(
        "SalaryComponent",
        back_populates="salary",
        cascade="all, delete-orphan",
        order_by="SalaryComponent.component_id",
    )
    payroll_runs = relationship("PayrollRun", back_populates="salary")

    @property
    def id(self) -> int:
        return cast(int, self.salary_id)

    @property
    def employee_public_id(self) -> str | None:
        if self.employee and hasattr(self.employee, "public_id"):
            return str(self.employee.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": self.employee_public_id,
            "basic_salary": float(cast(Decimal, self.basic_salary)),
            "net_salary": float(cast(Decimal, self.net_salary)),
            "currency": self.currency,
            "effective_from": (
                self.effective_from.isoformat()
                if hasattr(self.effective_from, "isoformat")
                else str(self.effective_from)
            ),
            "effective_to": (
                self.effective_to.isoformat()
                if self.effective_to and hasattr(self.effective_to, "isoformat")
                else None
            ),
            "components": [c.to_dict() for c in self.components] if self.components else [],
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
            "updated_at": (
                self.updated_at.isoformat()
                if hasattr(self.updated_at, "isoformat")
                else str(self.updated_at)
            ),
        }


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    component_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    salary_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("salaries.salary_id", ondelete="CASCADE")
    )
    component_name: Mapped[str] = mapped_column(String(100))
    component_type: Mapped[str] = mapped_column(String(20))  # 'earning' or 'deduction'
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    salary = relationship("Salary", back_populates="components")

    @property
    def id(self) -> int:
        return cast(int, self.component_id)

    def to_dict(self) -> dict:
        return {
            "component_id": self.id,
            "component_name": self.component_name,
            "component_type": self.component_type,
            "amount": float(cast(Decimal, self.amount)),
        }


class BankDetail(Base):
    __tablename__ = "bank_details"

    bank_detail_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    bank_name: Mapped[str] = mapped_column(String(150))
    branch_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    account_number: Mapped[str] = mapped_column(String(34))
    routing_code: Mapped[str] = mapped_column(String(20))
    account_type: Mapped[str] = mapped_column(String(20), default="savings")  # 'savings' or 'current'
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", back_populates="bank_details")

    @property
    def id(self) -> int:
        return cast(int, self.bank_detail_id)

    @property
    def employee_public_id(self) -> str | None:
        if self.employee and hasattr(self.employee, "public_id"):
            return str(self.employee.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": self.employee_public_id,
            "bank_name": self.bank_name,
            "branch_name": self.branch_name,
            "account_number": self.account_number,
            "routing_code": self.routing_code,
            "account_type": self.account_type,
            "is_primary": self.is_primary,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
            "updated_at": (
                self.updated_at.isoformat()
                if hasattr(self.updated_at, "isoformat")
                else str(self.updated_at)
            ),
        }


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    payroll_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    salary_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("salaries.salary_id", ondelete="SET NULL"), nullable=True
    )
    pay_period_start: Mapped[date] = mapped_column(Date)
    pay_period_end: Mapped[date] = mapped_column(Date)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00)
    net_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0.00)
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")  # 'pending', 'processed', 'paid', 'failed'
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'bank_transfer', 'cheque', 'cash'
    transaction_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", back_populates="payroll_runs")
    salary = relationship("Salary", back_populates="payroll_runs")

    @property
    def id(self) -> int:
        return cast(int, self.payroll_id)

    @property
    def employee_public_id(self) -> str | None:
        if self.employee and hasattr(self.employee, "public_id"):
            return str(self.employee.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": self.employee_public_id,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else "",
            "employee_code": self.employee.employee_code if self.employee else "",
            "department_name": self.employee.department.dept_name if self.employee and self.employee.department else None,
            "designation_title": self.employee.designation.title if self.employee and self.employee.designation else None,
            "salary_public_id": str(self.salary.public_id) if self.salary and hasattr(self.salary, "public_id") else None,
            "pay_period_start": (
                self.pay_period_start.isoformat()
                if hasattr(self.pay_period_start, "isoformat")
                else str(self.pay_period_start)
            ),
            "pay_period_end": (
                self.pay_period_end.isoformat()
                if hasattr(self.pay_period_end, "isoformat")
                else str(self.pay_period_end)
            ),
            "gross_amount": float(cast(Decimal, self.gross_amount)),
            "total_deductions": float(cast(Decimal, self.total_deductions)),
            "net_paid": float(cast(Decimal, self.net_paid)),
            "payment_date": (
                self.payment_date.isoformat()
                if self.payment_date and hasattr(self.payment_date, "isoformat")
                else None
            ),
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "transaction_ref": self.transaction_ref,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
            "updated_at": (
                self.updated_at.isoformat()
                if hasattr(self.updated_at, "isoformat")
                else str(self.updated_at)
            ),
        }
