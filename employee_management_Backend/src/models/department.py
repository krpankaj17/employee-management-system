# src/models/department.py
from datetime import datetime
from typing import cast
from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Department(Base):
    __tablename__ = "departments"

    dept_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    dept_name: Mapped[str] = mapped_column(String(100), unique=True)
    dept_code: Mapped[str] = mapped_column(String(10), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    head_employee_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employees = relationship(
        "Employee",
        back_populates="department",
        foreign_keys="[Employee.dept_id]",
    )
    head_employee = relationship("Employee", foreign_keys=[head_employee_id])

    @property
    def id(self) -> int:
        return cast(int, self.dept_id)

    @property
    def head_employee_public_id(self) -> str | None:
        if self.head_employee and hasattr(self.head_employee, "public_id"):
            return str(self.head_employee.public_id)
        return None

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "dept_name": self.dept_name,
            "dept_code": self.dept_code,
            "description": self.description,
            "head_employee_public_id": self.head_employee_public_id,
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
