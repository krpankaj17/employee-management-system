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
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True, index=True
    )
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # aadhaar, pan, passport, resume, offer_letter, experience_letter, other
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="Pending_Verification", server_default=text("'Pending_Verification'"))
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_by_user_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    verified_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
            "status": self.status or "Pending_Verification",
            "verification_notes": self.verification_notes,
            "verified_by_user_id": self.verified_by_user_id,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.uploaded_at.isoformat() if self.uploaded_at else datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

