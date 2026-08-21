# src/schemas/project_schema.py
import datetime
from pydantic import BaseModel, Field


class ProjectMemberIn(BaseModel):
    employee_public_id: str = Field(description="Employee public UUID")
    role_in_project: str = Field(default="Developer", description="Role e.g. Project Lead, Developer, QA")


class ProjectMemberOut(BaseModel):
    employee_public_id: str
    employee_name: str | None = None
    employee_code: str | None = None
    role_in_project: str | None = None
    assigned_at: str


class ProjectCreateIn(BaseModel):
    project_name: str = Field(min_length=2, max_length=200)
    description: str | None = None
    project_head_public_id: str | None = Field(default=None, description="Employee public UUID of Project Head")
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    status: str = Field(default="planning", description="planning | active | on_hold | completed | cancelled")


class ProjectUpdateIn(BaseModel):
    project_name: str | None = None
    description: str | None = None
    project_head_public_id: str | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    status: str | None = None


class ProjectOut(BaseModel):
    public_id: str
    project_name: str
    description: str | None = None
    project_head_public_id: str | None = None
    project_head_name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str
    member_count: int = 0
    members: list[ProjectMemberOut] = Field(default_factory=list)
    created_at: str
    updated_at: str


class PaginatedProjects(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[ProjectOut]
