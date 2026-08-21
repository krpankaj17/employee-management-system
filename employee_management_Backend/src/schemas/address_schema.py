# src/schemas/address_schema.py
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Any


class AddressIn(BaseModel):
    street_address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    country: str = Field(default="India", max_length=100)
    pincode: str = Field(min_length=3, max_length=10, description="Pincode format e.g. 560001")
    address_type: str = Field(default="current", description="'current' or 'permanent'")
    is_primary: bool = Field(default=False)


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    street_address: str
    city: str
    state: str
    country: str
    pincode: str
    formatted_address: str | None = None
    address_type: str | None = None
    is_primary: bool = False

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""


class EmergencyContactIn(BaseModel):
    contact_name: str = Field(min_length=1, max_length=150)
    relationship: str = Field(min_length=1, max_length=50, description="e.g. Spouse, Parent, Sibling")
    phone: str = Field(min_length=7, max_length=15)
    email: str | None = Field(default=None, max_length=255)
    is_primary: bool = Field(default=False)


class EmergencyContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contact_id: int
    contact_name: str
    relationship: str
    phone: str
    email: str | None = None
    is_primary: bool = False
