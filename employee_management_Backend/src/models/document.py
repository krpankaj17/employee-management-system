# src/models/document.py
import datetime
from typing import cast
from sqlalchemy import BigInteger, String, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class EmployeeDocument(Base):
    __tablename__ = "employee_documents"

    document_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False
    )
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)  # aadhaar, pan, passport, resume, offer_letter, experience_letter, other
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    uploaded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee")

    @property
    def id(self) -> int:
        return cast(int, self.document_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": str(self.employee.public_id) if self.employee else None,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else None,
            "document_name": self.document_name,
            "document_type": self.document_type,
            "document_url": self.document_url,
            "file_size_bytes": self.file_size_bytes,
            "uploaded_at": (
                self.uploaded_at.isoformat()
                if hasattr(self.uploaded_at, "isoformat")
                else str(self.uploaded_at)
            ),
            "updated_at": (
                self.updated_at.isoformat()
                if hasattr(self.updated_at, "isoformat")
                else str(self.updated_at)
            ),
        }
