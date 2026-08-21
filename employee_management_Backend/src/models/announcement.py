# src/models/announcement.py
import datetime
from typing import cast
from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Announcement(Base):
    __tablename__ = "announcements"

    announcement_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low, normal, high, urgent
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)  # all, department
    target_dept_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.dept_id", ondelete="CASCADE"), nullable=True
    )
    posted_by: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    author = relationship("Employee", foreign_keys=[posted_by])
    department = relationship("Department", foreign_keys=[target_dept_id])

    @property
    def id(self) -> int:
        return cast(int, self.announcement_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "title": self.title,
            "content": self.content,
            "priority": self.priority,
            "target_type": self.target_type,
            "target_department": self.department.dept_name if self.department else None,
            "target_department_public_id": str(self.department.public_id) if self.department else None,
            "author_name": f"{self.author.first_name} {self.author.last_name}" if self.author else None,
            "author_public_id": str(self.author.public_id) if self.author else None,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False)  # leave, attendance, payroll, announcement, review, general
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)  # employee, department, all
    target_employee_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=True
    )
    target_dept_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.dept_id", ondelete="CASCADE"), nullable=True
    )
    created_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    recipients = relationship("NotificationRecipient", back_populates="notification", cascade="all, delete-orphan")


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    recipient_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    notification_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("notifications.notification_id", ondelete="CASCADE"), nullable=False
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="unread")  # unread, read, archived
    read_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    notification = relationship("Notification", back_populates="recipients")
    employee = relationship("Employee")

    def to_dict(self) -> dict:
        return {
            "recipient_id": self.recipient_id,
            "notification_public_id": str(self.notification.public_id) if self.notification else None,
            "title": self.notification.title if self.notification else "",
            "message": self.notification.message if self.notification else "",
            "notification_type": self.notification.notification_type if self.notification else "general",
            "status": self.status,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }
