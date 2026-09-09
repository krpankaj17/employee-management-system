# src/schemas/department_schema.py
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class DepartmentIn(BaseModel):
    dept_name: str = Field(min_length=1, max_length=150)
    dept_code: str = Field(min_length=1, max_length=20, description="e.g. ENG, HR, FIN, OPS")
    description: str | None = None
    head_employee_public_id: str | None = Field(
        default=None, description="Head employee UUID (public_id)"
    )


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    dept_name: str
    dept_code: str
    description: str | None = None
    head_employee_public_id: str | None = None
    head_employee_name: str | None = None
    employee_count: int = 0
    department_name: str | None = None
    department_code: str | None = None

    @field_validator("public_id", "head_employee_public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    @model_validator(mode="after")
    def populate_aliases(self) -> "DepartmentOut":
        if not self.department_name:
            self.department_name = self.dept_name
        if not self.department_code:
            self.department_code = self.dept_code
        return self


class PaginatedDepartments(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[DepartmentOut]


class DepartmentEmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    employee_code: str
    first_name: str
    last_name: str
    email: str
    employee_status: str

    @field_validator("public_id", mode="before")
    @classmethod
    def format_uuid(cls, value: Any) -> str:
        return str(value) if value is not None else ""


class DepartmentEmployees(BaseModel):
    department_public_id: str
    total: int
    skip: int
    limit: int | None
    items: list[DepartmentEmployeeOut]
