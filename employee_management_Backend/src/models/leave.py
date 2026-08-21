# src/models/leave.py
from datetime import date, datetime
from decimal import Decimal
from typing import cast
from sqlalchemy import BigInteger, String, Date, DateTime, Numeric, Boolean, Integer, Text, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class LeaveType(Base):
    __tablename__ = "leave_types"

    leave_type_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_days_per_year: Mapped[int] = mapped_column(Integer, default=0)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    @property
    def id(self) -> int:
        return cast(int, self.leave_type_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "name": self.name,
            "description": self.description,
            "max_days_per_year": self.max_days_per_year,
            "is_paid": self.is_paid,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }


class EmployeeLeaveBalance(Base):
    __tablename__ = "employee_leave_balances"

    balance_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    leave_type_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("leave_types.leave_type_id", ondelete="CASCADE")
    )
    year: Mapped[int] = mapped_column(Integer)
    total_allocated: Mapped[int] = mapped_column(Integer, default=0)
    used_leaves: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee")
    leave_type = relationship("LeaveType")

    @property
    def id(self) -> int:
        return cast(int, self.balance_id)

    @property
    def remaining_leaves(self) -> int:
        return cast(int, self.total_allocated - self.used_leaves)

    def to_dict(self) -> dict:
        return {
            "balance_id": self.balance_id,
            "public_id": str(self.public_id),
            "employee_id": self.employee_id,
            "employee_public_id": str(self.employee.public_id) if self.employee else None,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else None,
            "leave_type_id": self.leave_type_id,
            "leave_type_public_id": str(self.leave_type.public_id) if self.leave_type else None,
            "leave_type_name": self.leave_type.name if self.leave_type else None,
            "year": self.year,
            "total_allocated": self.total_allocated,
            "used_leaves": self.used_leaves,
            "remaining_leaves": self.remaining_leaves,
            "updated_at": (
                self.updated_at.isoformat()
                if hasattr(self.updated_at, "isoformat")
                else str(self.updated_at)
            ),
        }


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    leave_type_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT")
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    total_days: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", foreign_keys=[employee_id])
    approver = relationship("Employee", foreign_keys=[approved_by])
    leave_type = relationship("LeaveType")
    history = relationship("LeaveApprovalHistory", back_populates="leave_request", cascade="all, delete-orphan")

    @property
    def id(self) -> int:
        return cast(int, self.leave_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": str(self.employee.public_id) if self.employee else None,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else None,
            "leave_type_public_id": str(self.leave_type.public_id) if self.leave_type else None,
            "leave_type_name": self.leave_type.name if self.leave_type else None,
            "start_date": str(self.start_date) if self.start_date else "",
            "end_date": str(self.end_date) if self.end_date else "",
            "total_days": float(cast(Decimal, self.total_days)) if self.total_days is not None else 0.0,
            "reason": self.reason,
            "status": self.status,
            "approved_by_public_id": str(self.approver.public_id) if self.approver else None,
            "rejection_reason": self.rejection_reason,
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
            "history": [h.to_dict() for h in self.history] if self.history else [],
        }


class LeaveApprovalHistory(Base):
    __tablename__ = "leave_approval_history"

    history_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    leave_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("leave_requests.leave_id", ondelete="CASCADE")
    )
    action_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    action: Mapped[str] = mapped_column(String(20))  # submitted, approved, rejected, escalated, cancelled
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    leave_request = relationship("LeaveRequest", back_populates="history")
    actor = relationship("Employee", foreign_keys=[action_by])

    def to_dict(self) -> dict:
        return {
            "history_id": self.history_id,
            "action": self.action,
            "action_by_public_id": str(self.actor.public_id) if self.actor else None,
            "action_by_name": f"{self.actor.first_name} {self.actor.last_name}" if self.actor else None,
            "action_at": (
                self.action_at.isoformat()
                if hasattr(self.action_at, "isoformat")
                else str(self.action_at)
            ),
            "remarks": self.remarks,
        }
