# src/models/employee.py
from datetime import date, datetime
from typing import cast
from sqlalchemy import BigInteger, String, Date, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from database import Base


class Employee(Base):
    __tablename__ = "employees"

    emp_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    employee_code: Mapped[str] = mapped_column(String(20), unique=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True)
    joining_date: Mapped[date] = mapped_column(Date)
    employee_status: Mapped[str] = mapped_column(String(20), default="active")
    employment_type: Mapped[str] = mapped_column(String(20), default="full_time")
    dept_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.dept_id", ondelete="RESTRICT"), nullable=True
    )
    designation_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("designations.designation_id", ondelete="SET NULL"), nullable=True
    )
    reporting_manager_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.user_id", ondelete="RESTRICT"), unique=True
    )

    # Relationships
    department = orm_relationship(
        "Department",
        back_populates="employees",
        foreign_keys=[dept_id],
    )
    designation = orm_relationship(
        "Designation",
        back_populates="employees",
        foreign_keys=[designation_id],
    )
    employee_addresses = orm_relationship(
        "EmployeeAddress",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    emergency_contacts = orm_relationship(
        "EmergencyContact",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    reporting_manager = orm_relationship(
        "Employee",
        remote_side=[emp_id],
        foreign_keys=[reporting_manager_id],
        back_populates="direct_reports",
    )
    direct_reports = orm_relationship(
        "Employee",
        foreign_keys=[reporting_manager_id],
        back_populates="reporting_manager",
    )
    user = orm_relationship(
        "User",
        back_populates="employee",
        foreign_keys=[user_id],
    )
    salaries = orm_relationship(
        "Salary",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    bank_details = orm_relationship(
        "BankDetail",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    payroll_runs = orm_relationship(
        "PayrollRun",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    @property
    def id(self) -> int:
        """Backwards-compatible alias for internal use."""
        return cast(int, self.emp_id)

    @property
    def department_public_id(self) -> str | None:
        """Computed property: resolves internal dept_id → department.public_id UUID."""
        if self.department and hasattr(self.department, "public_id"):
            return str(self.department.public_id)
        return None

    @property
    def designation_public_id(self) -> str | None:
        """Computed property: resolves internal designation_id → designation.public_id UUID."""
        if self.designation and hasattr(self.designation, "public_id"):
            return str(self.designation.public_id)
        return None

    @property
    def reporting_manager_public_id(self) -> str | None:
        """Computed property: resolves internal reporting_manager_id → reporting_manager.public_id UUID."""
        if self.reporting_manager and hasattr(self.reporting_manager, "public_id"):
            return str(self.reporting_manager.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "id": self.emp_id,
            "emp_id": self.emp_id,
            "public_id": str(self.public_id),
            "employee_code": self.employee_code,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "date_of_birth": str(self.date_of_birth) if self.date_of_birth else "",
            "gender": self.gender,
            "email": self.email,
            "phone": self.phone,
            "joining_date": str(self.joining_date) if self.joining_date else "",
            "employee_status": self.employee_status,
            "employment_type": self.employment_type,
            "dept_id": self.dept_id,
            "department_public_id": self.department_public_id,
            "designation_id": self.designation_id,
            "designation_public_id": self.designation_public_id,
            "reporting_manager_id": self.reporting_manager_id,
            "reporting_manager_public_id": self.reporting_manager_public_id,
            "is_active": self.is_active,
            "user_id": self.user_id,
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


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    contact_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    contact_name: Mapped[str] = mapped_column(String(150))
    relationship: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(15))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = orm_relationship("Employee", back_populates="emergency_contacts")

    def to_dict(self) -> dict:
        return {
            "contact_id": self.contact_id,
            "contact_name": self.contact_name,
            "relationship": self.relationship,
            "phone": self.phone,
            "email": self.email,
            "is_primary": self.is_primary,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }
