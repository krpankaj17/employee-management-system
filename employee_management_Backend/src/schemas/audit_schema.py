# src/schemas/audit_schema.py
from typing import Any
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    log_id: int
    user_email: str
    user_public_id: str | None = None
    action: str
    entity_name: str
    entity_id: str | None = None
    old_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: str


class PaginatedAuditLogs(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[AuditLogOut]
