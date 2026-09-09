# src/repository/audit_repo.py
import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload
from models.audit import AuditLog


def list_audit_logs(
    entity_name: str | None,
    action: str | None,
    user_id: int | None,
    date_from: datetime.datetime | None,
    date_to: datetime.datetime | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> tuple[list[AuditLog], int]:
    """Lists audit logs with filtering and pagination."""
    query = select(AuditLog).options(joinedload(AuditLog.user))

    if entity_name:
        query = query.where(AuditLog.entity_name == entity_name)
    if action:
        query = query.where(AuditLog.action == action)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_stmt) or 0

    query = query.order_by(AuditLog.created_at.desc()).offset(skip)
    if limit:
        query = query.limit(limit)

    results = list(db.scalars(query).all())
    return results, total
