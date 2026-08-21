# src/schemas/announcement_schema.py
import datetime
from pydantic import BaseModel, Field


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    content: str = Field(min_length=5)
    priority: str = Field(default="normal", description="low | normal | high | urgent")
    target_type: str = Field(default="all", description="all | department")
    target_department_public_id: str | None = Field(default=None, description="Required if target_type is department")
    expires_at: datetime.datetime | None = None


class AnnouncementOut(BaseModel):
    public_id: str
    title: str
    content: str
    priority: str
    target_type: str
    target_department: str | None = None
    target_department_public_id: str | None = None
    author_name: str | None = None
    author_public_id: str | None = None
    is_active: bool
    expires_at: str | None = None
    created_at: str


class NotificationIn(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    message: str = Field(min_length=2)
    notification_type: str = Field(
        default="general",
        description="leave | attendance | payroll | announcement | review | general",
    )
    target_type: str = Field(default="all", description="employee | department | all")
    target_employee_public_id: str | None = None
    target_department_public_id: str | None = None


class NotificationRecipientOut(BaseModel):
    recipient_id: int
    notification_public_id: str | None = None
    title: str
    message: str
    notification_type: str
    status: str
    read_at: str | None = None
    created_at: str
