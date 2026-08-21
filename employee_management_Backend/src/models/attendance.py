# src/models/attendance.py
from datetime import date as py_date, datetime
from decimal import Decimal
from typing import cast
from sqlalchemy import BigInteger, String, Date, DateTime, Numeric, Boolean, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    date: Mapped[py_date] = mapped_column(Date)
    check_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    work_mode: Mapped[str] = mapped_column(String(20), default="in_office")
    status: Mapped[str] = mapped_column(String(20), default="present")
    total_hours: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), default=0.00)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee")

    @property
    def id(self) -> int:
        return cast(int, self.attendance_id)

    @property
    def employee_id(self) -> int:
        return cast(int, self.emp_id)

    @property
    def employee_public_id(self) -> str | None:
        if self.employee and hasattr(self.employee, "public_id"):
            return str(self.employee.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "id": self.attendance_id,
            "attendance_id": self.attendance_id,
            "public_id": str(self.public_id),
            "employee_id": self.emp_id,
            "employee_public_id": self.employee_public_id,
            "date": str(self.date) if self.date else "",
            "check_in": (
                self.check_in.strftime("%H:%M:%S")
                if self.check_in and hasattr(self.check_in, "strftime")
                else None
            ),
            "check_out": (
                self.check_out.strftime("%H:%M:%S")
                if self.check_out and hasattr(self.check_out, "strftime")
                else None
            ),
            "work_mode": self.work_mode,
            "status": self.status,
            "total_hours": float(cast(Decimal, self.total_hours)) if self.total_hours is not None else 0.0,
            "notes": self.notes,
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


class Holiday(Base):
    __tablename__ = "holidays"

    holiday_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(150))
    date: Mapped[py_date] = mapped_column(Date)
    holiday_type: Mapped[str] = mapped_column(String(20), default="company")
    year: Mapped[int] = mapped_column(Integer)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)
    applicable_region: Mapped[str] = mapped_column(String(100), default="ALL")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    @property
    def id(self) -> int:
        return cast(int, self.holiday_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "name": self.name,
            "date": str(self.date) if self.date else "",
            "holiday_type": self.holiday_type,
            "year": self.year,
            "is_optional": self.is_optional,
            "applicable_region": self.applicable_region,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }
