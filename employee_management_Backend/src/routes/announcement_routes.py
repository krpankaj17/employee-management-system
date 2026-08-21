# src/routes/announcement_routes.py
from typing import cast
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.announcement_schema import (
    AnnouncementIn,
    AnnouncementOut,
    NotificationIn,
    NotificationRecipientOut,
)
from services import announcement_service

router = APIRouter(prefix="/announcements", tags=["Announcements & Notifications"])


@router.get("", response_model=list[AnnouncementOut], dependencies=[Depends(require_permission("announcement:read"))])
def list_announcements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists company-wide and department-specific active announcements. Requires 'announcement:read'."""
    dept_public_id = None
    if current_user.employee and current_user.employee.department:
        dept_public_id = str(current_user.employee.department.public_id)

    return announcement_service.list_announcements(dept_public_id, db=db)


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("announcement:create"))])
def create_announcement(
    payload: AnnouncementIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Posts a new announcement. Requires 'announcement:create' permission."""
    if not current_user.employee:
        raise HTTPException(status_code=403, detail="Author must have an active employee profile")

    author_emp_id = cast(int, current_user.employee.emp_id)
    res = announcement_service.create_announcement(payload, author_emp_id=author_emp_id, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["announcement"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("announcement:delete"))])
def delete_announcement(public_id: str, db: Session = Depends(get_db)):
    """Deletes an announcement. Requires 'announcement:delete' permission."""
    res = announcement_service.delete_announcement(public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return {"details": res["details"]}


# ─── Notifications Endpoints ───────────────────────────────────────────────────

@router.post("/notifications/send", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("notification:create"))])
def send_notification(
    payload: NotificationIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dispatches a notification to employee, department, or all. Requires 'notification:create'."""
    creator_emp_id = cast(int, current_user.employee.emp_id) if current_user.employee else None
    res = announcement_service.send_notification(payload, creator_emp_id=creator_emp_id, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return {"ok": True, "recipients_count": res["recipients_count"]}


@router.get("/notifications/inbox", response_model=list[NotificationRecipientOut], dependencies=[Depends(require_permission("notification:read"))])
def get_my_notifications(
    unread_only: bool = Query(False, description="Filter to only unread notifications"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves notifications inbox for current logged-in employee."""
    if not current_user.employee:
        raise HTTPException(status_code=404, detail="No employee profile linked to user")

    emp_id = cast(int, current_user.employee.emp_id)
    return announcement_service.get_my_notifications(emp_id, unread_only=unread_only, db=db)


@router.post("/notifications/{recipient_id}/read", dependencies=[Depends(require_permission("notification:read"))])
def mark_notification_read(
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marks an in-app notification as read."""
    if not current_user.employee:
        raise HTTPException(status_code=404, detail="No employee profile linked to user")

    emp_id = cast(int, current_user.employee.emp_id)
    res = announcement_service.mark_read(recipient_id, emp_id=emp_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return res["item"]
