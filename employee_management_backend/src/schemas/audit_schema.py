# src/schemas/audit_schema.py
import json
from typing import Any
from pydantic import BaseModel, field_validator


class AuditLogOut(BaseModel):
    log_id: int
    user_email: str
    user_public_id: str | None = None
    action: str
    entity_name: str
    entity_id: str | None = None
    old_values: dict[str, Any] | None = None
    new_values: dict[str, Any] | None = None

    @field_validator("old_values", "new_values", mode="before")
    @classmethod
    def parse_json_values(cls, value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return {"value": value}
        return value


class PaginatedAuditLogs(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[AuditLogOut]
