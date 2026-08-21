# src/models/designation.py
from datetime import datetime
from typing import cast
from sqlalchemy import BigInteger, String, Text, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Designation(Base):
    __tablename__ = "designations"

    designation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(150), unique=True)
    grade_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employees = relationship("Employee", back_populates="designation")

    @property
    def id(self) -> int:
        return cast(int, self.designation_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "title": self.title,
            "grade_level": self.grade_level,
            "description": self.description,
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
