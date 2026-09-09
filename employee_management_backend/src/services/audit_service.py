# src/services/audit_service.py
import datetime
from typing import Any, cast
from sqlalchemy.orm import Session
from repository import audit_repo as repo
from repository import auth_repo


def list_audit_logs(
    entity_name: str | None,
    action: str | None,
    user_public_id: str | None,
    date_from: datetime.datetime | None,
    date_to: datetime.datetime | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> dict[str, Any]:
    """Lists compliance audit logs with filtering and pagination."""
    user_id = None
    if user_public_id:
        user = auth_repo.get_user_by_public_id(user_public_id, db=db)
        if user:
            user_id = cast(int, user.user_id)

    logs, total = repo.list_audit_logs(
        entity_name=entity_name,
        action=action,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
        db=db,
    )
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [log.to_dict() for log in logs],
    }
