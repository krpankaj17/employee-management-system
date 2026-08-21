# src/models/review.py
import datetime
from decimal import Decimal
from typing import cast
from sqlalchemy import BigInteger, String, Text, Date, DateTime, Numeric, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    review_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()"), unique=True
    )
    emp_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False
    )
    reviewer_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE"), nullable=False
    )
    review_period_start: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    review_period_end: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 1), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, submitted, acknowledged, finalized

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", foreign_keys=[emp_id])
    reviewer = relationship("Employee", foreign_keys=[reviewer_id])

    @property
    def id(self) -> int:
        return cast(int, self.review_id)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "employee_public_id": str(self.employee.public_id) if self.employee else None,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}" if self.employee else None,
            "reviewer_public_id": str(self.reviewer.public_id) if self.reviewer else None,
            "reviewer_name": f"{self.reviewer.first_name} {self.reviewer.last_name}" if self.reviewer else None,
            "review_period_start": self.review_period_start.isoformat(),
            "review_period_end": self.review_period_end.isoformat(),
            "rating": float(cast(Decimal, self.rating)) if self.rating is not None else None,
            "comments": self.comments,
            "status": self.status,
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
