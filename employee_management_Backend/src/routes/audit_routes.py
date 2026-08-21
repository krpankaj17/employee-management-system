# src/routes/audit_routes.py
import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission
from schemas.audit_schema import PaginatedAuditLogs
from services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["Audit Trail & Compliance"])


@router.get("", response_model=PaginatedAuditLogs, dependencies=[Depends(require_permission("audit:read"))])
def list_audit_logs(
    entity_name: str | None = Query(None, description="Filter by entity e.g. employees, salaries, departments"),
    action: str | None = Query(None, description="Filter by action name e.g. UPDATE_SALARY, APPROVE_LEAVE"),
    user_public_id: str | None = Query(None, description="Filter by actor user UUID"),
    date_from: datetime.datetime | None = Query(None, description="ISO timestamp filter from"),
    date_to: datetime.datetime | None = Query(None, description="ISO timestamp filter to"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(50, gt=0),
    db: Session = Depends(get_db),
):
    """Retrieves immutable audit logs for system operations. Requires 'audit:read' permission."""
    return audit_service.list_audit_logs(
        entity_name=entity_name,
        action=action,
        user_public_id=user_public_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
        db=db,
    )
