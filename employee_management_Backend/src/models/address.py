# src/models/address.py
from datetime import datetime
from typing import cast
from sqlalchemy import BigInteger, String, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Address(Base):
    __tablename__ = "addresses"

    address_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    public_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), server_default=text("gen_random_uuid()")
    )
    street_address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), default="India")
    pincode: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee_links = relationship("EmployeeAddress", back_populates="address", cascade="all, delete-orphan")

    @property
    def id(self) -> int:
        return cast(int, self.address_id)

    @property
    def formatted_address(self) -> str:
        parts = [str(self.street_address or ""), str(self.city or ""), str(self.state or ""), str(self.country or ""), str(self.pincode or "")]
        return ", ".join(p for p in parts if p)

    def to_dict(self) -> dict:
        return {
            "public_id": str(self.public_id),
            "street_address": self.street_address,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "pincode": self.pincode,
            "formatted_address": self.formatted_address,
            "created_at": (
                self.created_at.isoformat()
                if hasattr(self.created_at, "isoformat")
                else str(self.created_at)
            ),
        }


class EmployeeAddress(Base):
    __tablename__ = "employee_addresses"

    employee_address_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    employee_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("employees.emp_id", ondelete="CASCADE")
    )
    address_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("addresses.address_id", ondelete="CASCADE")
    )
    address_type: Mapped[str] = mapped_column(String(20))  # 'current' or 'permanent'
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    # Relationships
    employee = relationship("Employee", back_populates="employee_addresses")
    address = relationship("Address", back_populates="employee_links")

    def to_dict(self) -> dict:
        addr_dict = self.address.to_dict() if self.address else {}
        return {
            "address_type": self.address_type,
            "is_primary": self.is_primary,
            **addr_dict,
        }
