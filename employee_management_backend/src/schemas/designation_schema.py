# src/schemas/designation_schema.py
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class DesignationIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    grade_level: str | None = Field(default=None, max_length=20, description="e.g. L1, L2, L5, Grade-A")
    description: str | None = None


class DesignationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    title: str
    grade_level: str | None = None
    description: str | None = None
    designation_name: str | None = None

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""

    @model_validator(mode="after")
    def populate_designation_name(self) -> "DesignationOut":
        if not self.designation_name:
            self.designation_name = self.title
        return self


class PaginatedDesignations(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[DesignationOut]
