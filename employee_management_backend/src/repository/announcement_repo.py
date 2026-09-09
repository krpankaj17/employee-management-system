# src/repository/announcement_repo.py
import datetime
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, joinedload
from models.announcement import Announcement, Notification, NotificationRecipient


def get_announcement_by_public_id(public_id: str, db: Session) -> Announcement | None:
    """Finds announcement by public UUID."""
    stmt = (
        select(Announcement)
        .options(joinedload(Announcement.author), joinedload(Announcement.department))
        .where(Announcement.public_id == public_id)
    )
    return db.scalar(stmt)


def list_active_announcements(dept_id: int | None, db: Session) -> list[Announcement]:
    """Lists non-expired active announcements for all employees or specific department."""
    now = datetime.datetime.now(datetime.timezone.utc)
    stmt = (
        select(Announcement)
        .options(joinedload(Announcement.author), joinedload(Announcement.department))
        .where(
            Announcement.is_active.is_(True),
            or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
        )
    )
    if dept_id:
        stmt = stmt.where(
            or_(Announcement.target_type == "all", Announcement.target_dept_id == dept_id)
        )
    else:
        stmt = stmt.where(Announcement.target_type == "all")

    stmt = stmt.order_by(Announcement.created_at.desc())
    return list(db.scalars(stmt).all())


def create_announcement(ann: Announcement, db: Session) -> Announcement:
    """Persists a new announcement."""
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


def delete_announcement(ann: Announcement, db: Session) -> None:
    """Deletes an announcement."""
    db.delete(ann)
    db.commit()


def create_notification(notif: Notification, db: Session) -> Notification:
    """Creates a notification and returns it."""
    db.add(notif)
    db.flush()
    return notif


def create_notification_recipients(recipients: list[NotificationRecipient], db: Session) -> None:
    """Bulk inserts notification recipients."""
    db.add_all(recipients)
    db.commit()


def get_employee_notifications(emp_id: int, unread_only: bool, db: Session) -> list[NotificationRecipient]:
    """Fetches notifications delivered to an employee."""
    stmt = (
        select(NotificationRecipient)
        .options(joinedload(NotificationRecipient.notification))
        .where(NotificationRecipient.emp_id == emp_id)
    )
    if unread_only:
        stmt = stmt.where(NotificationRecipient.status == "unread")

    stmt = stmt.order_by(NotificationRecipient.created_at.desc()).limit(50)
    return list(db.scalars(stmt).all())


def mark_notification_read(recipient_id: int, emp_id: int, db: Session) -> NotificationRecipient | None:
    """Marks a recipient's notification as read."""
    stmt = select(NotificationRecipient).where(
        NotificationRecipient.recipient_id == recipient_id,
        NotificationRecipient.emp_id == emp_id,
    )
    item = db.scalar(stmt)
    if item:
        item.status = "read"
        item.read_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        db.refresh(item)
    return item
