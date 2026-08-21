# src/services/announcement_service.py
from typing import Any, cast
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.announcement import Announcement, Notification, NotificationRecipient
from models.employee import Employee
from repository import announcement_repo as repo
from repository import employee_repository as emp_repo
from repository import department_repo as dept_repo
from schemas.announcement_schema import AnnouncementIn, NotificationIn
from utils.logger import log_action


def create_announcement(
    payload: AnnouncementIn, author_emp_id: int, db: Session
) -> dict[str, Any]:
    """Posts a company announcement."""
    dept_id = None
    if payload.target_type == "department":
        if not payload.target_department_public_id:
            return {"ok": False, "error": "validation", "message": "target_department_public_id is required when target_type is 'department'"}
        dept = dept_repo.get_by_public_id(payload.target_department_public_id, db=db)
        if not dept:
            return {"ok": False, "error": "not_found", "message": f"Department '{payload.target_department_public_id}' not found"}
        dept_id = dept.dept_id

    ann = Announcement(
        title=payload.title.strip(),
        content=payload.content.strip(),
        priority=payload.priority,
        target_type=payload.target_type,
        target_dept_id=dept_id,
        posted_by=author_emp_id,
        expires_at=payload.expires_at,
        is_active=True,
    )
    saved = repo.create_announcement(ann, db=db)
    log_action("ANNOUNCEMENT_POSTED", f"Announcement '{saved.title}' posted by employee ID {author_emp_id}")
    return {"ok": True, "announcement": saved.to_dict()}


def list_announcements(user_dept_public_id: str | None, db: Session) -> list[dict[str, Any]]:
    """Lists non-expired announcements for the user."""
    dept_id = None
    if user_dept_public_id:
        dept = dept_repo.get_by_public_id(user_dept_public_id, db=db)
        if dept:
            dept_id = dept.dept_id

    items = repo.list_active_announcements(dept_id, db=db)
    return [a.to_dict() for a in items]


def delete_announcement(public_id: str, db: Session) -> dict[str, Any]:
    """Deletes an announcement."""
    ann = repo.get_announcement_by_public_id(public_id, db=db)
    if not ann:
        return {"ok": False, "error": "not_found", "message": f"Announcement '{public_id}' not found"}

    repo.delete_announcement(ann, db=db)
    log_action("ANNOUNCEMENT_DELETED", f"Announcement '{ann.title}' deleted")
    return {"ok": True, "details": f"Announcement '{public_id}' deleted"}


def send_notification(
    payload: NotificationIn, creator_emp_id: int | None, db: Session
) -> dict[str, Any]:
    """Dispatches a notification to target recipient(s)."""
    target_emp_id = None
    target_dept_id = None

    if payload.target_type == "employee":
        if not payload.target_employee_public_id:
            return {"ok": False, "error": "validation", "message": "target_employee_public_id is required"}
        emp = emp_repo.get_by_public_id(payload.target_employee_public_id, db=db)
        if not emp:
            return {"ok": False, "error": "not_found", "message": f"Employee '{payload.target_employee_public_id}' not found"}
        target_emp_id = cast(int, emp.emp_id)

    elif payload.target_type == "department":
        if not payload.target_department_public_id:
            return {"ok": False, "error": "validation", "message": "target_department_public_id is required"}
        dept = dept_repo.get_by_public_id(payload.target_department_public_id, db=db)
        if not dept:
            return {"ok": False, "error": "not_found", "message": f"Department '{payload.target_department_public_id}' not found"}
        target_dept_id = dept.dept_id

    notif = Notification(
        title=payload.title.strip(),
        message=payload.message.strip(),
        notification_type=payload.notification_type,
        target_type=payload.target_type,
        target_employee_id=target_emp_id,
        target_dept_id=target_dept_id,
        created_by=creator_emp_id,
    )
    saved_notif = repo.create_notification(notif, db=db)

    # Determine recipient employee IDs
    recipient_emp_ids: list[int] = []
    if target_emp_id:
        recipient_emp_ids = [target_emp_id]
    elif target_dept_id:
        dept_emps = list(db.scalars(select(Employee.emp_id).where(Employee.department_id == target_dept_id, Employee.employee_status == "active")).all())
        recipient_emp_ids = [cast(int, e) for e in dept_emps]
    else:
        all_emps = list(db.scalars(select(Employee.emp_id).where(Employee.employee_status == "active")).all())
        recipient_emp_ids = [cast(int, e) for e in all_emps]

    recipients = [
        NotificationRecipient(notification_id=cast(int, saved_notif.notification_id), emp_id=eid)
        for eid in recipient_emp_ids
    ]
    if recipients:
        repo.create_notification_recipients(recipients, db=db)

    log_action("NOTIFICATION_SENT", f"Notification '{saved_notif.title}' dispatched to {len(recipients)} recipients")
    return {"ok": True, "recipients_count": len(recipients)}


def get_my_notifications(
    emp_id: int, unread_only: bool, db: Session
) -> list[dict[str, Any]]:
    """Retrieves notification inbox for an employee."""
    items = repo.get_employee_notifications(emp_id, unread_only=unread_only, db=db)
    return [i.to_dict() for i in items]


def mark_read(recipient_id: int, emp_id: int, db: Session) -> dict[str, Any]:
    """Marks a single notification as read."""
    updated = repo.mark_notification_read(recipient_id, emp_id=emp_id, db=db)
    if not updated:
        return {"ok": False, "error": "not_found", "message": "Notification not found or access denied"}
    return {"ok": True, "item": updated.to_dict()}
