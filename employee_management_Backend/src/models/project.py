# src/models/project.py
import datetime
from typing import TYPE_CHECKING, cast
from sqlalchemy import BigInteger, String, Text, Date, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.employee import Employee


class Project(Base):
    __tablename__ = "projects"

    project_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    project_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_head_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    start_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planning")  # planning, active, on_hold, completed, cancelled

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    project_head: Mapped["Employee | None"] = relationship("Employee", foreign_keys=[project_head_id])
    members: Mapped[list["ProjectMember"]] = relationship(
        "ProjectMember", back_populates="project", cascade="all, delete-orphan"
    )

    @property
    def id(self) -> int:
        return cast(int, self.project_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "project_name": self.project_name,
            "description": self.description,
            "project_head_public_id": str(self.project_head.public_id) if self.project_head else None,
            "project_head_name": f"{self.project_head.first_name} {self.project_head.last_name}" if self.project_head else None,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "member_count": len(cast(list, self.members)) if self.members else 0,
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


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("projects.project_id", ondelete="CASCADE"), primary_key=True
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), primary_key=True
    )
    role_in_project: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="members")
    employee: Mapped["Employee | None"] = relationship("Employee")

    def to_dict(self) -> dict:
        return {
            "employee_public_id": str(self.employee.public_id) if self.employee else None,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else None,
            "employee_code": self.employee.employee_code if self.employee else None,
            "role_in_project": self.role_in_project,
            "assigned_at": (
                self.assigned_at.isoformat()
                if hasattr(self.assigned_at, "isoformat")
                else str(self.assigned_at)
            ),
        }
