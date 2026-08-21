# src/repository/designation_repo.py
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from models.designation import Designation
from models.employee import Employee


def get_paginated(
    db: Session, skip: int = 0, limit: int | None = None
) -> tuple[int, list[Designation]]:
    """Fetches total count and paginated list of designations."""
    total = db.scalar(select(func.count()).select_from(Designation)) or 0
    stmt = select(Designation).order_by(Designation.designation_id).offset(skip)
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list(db.scalars(stmt).all())
    return total, items


def get_all(db: Session) -> list[Designation]:
    """Returns all designations."""
    stmt = select(Designation).order_by(Designation.designation_id)
    return list(db.scalars(stmt).all())


def get_by_id(designation_id: int, db: Session) -> Designation | None:
    """Finds designation by internal ID."""
    return db.scalar(select(Designation).where(Designation.designation_id == designation_id))


def get_by_public_id(public_id: str, db: Session) -> Designation | None:
    """Finds designation by public UUID."""
    if not public_id:
        return None
    return db.scalar(select(Designation).where(Designation.public_id == public_id))


def get_by_title(title: str, db: Session) -> Designation | None:
    """Finds designation by title (case-insensitive)."""
    if not title:
        return None
    return db.scalar(select(Designation).where(func.lower(Designation.title) == title.strip().lower()))


def create_designation(
    title: str,
    db: Session,
    grade_level: str | None = None,
    description: str | None = None,
) -> Designation:
    """Creates a new designation."""
    desig = Designation(
        title=title.strip(),
        grade_level=grade_level.strip().upper() if grade_level else None,
        description=description.strip() if description else None,
    )
    db.add(desig)
    db.commit()
    db.refresh(desig)
    return desig


def update_designation(
    public_id: str,
    title: str,
    db: Session,
    grade_level: str | None = None,
    description: str | None = None,
) -> Designation | None:
    """Updates designation details."""
    desig = get_by_public_id(public_id, db=db)
    if not desig:
        return None

    desig.title = title.strip()
    desig.grade_level = grade_level.strip().upper() if grade_level else None
    desig.description = description.strip() if description else None
    db.commit()
    db.refresh(desig)
    return desig


def delete_designation(public_id: str, db: Session) -> tuple[bool, str | None]:
    """Deletes a designation. Blocks deletion if active employees are assigned."""
    desig = get_by_public_id(public_id, db=db)
    if not desig:
        return False, "Designation not found"

    assigned_count = db.scalar(
        select(func.count()).select_from(Employee).where(Employee.designation_id == desig.designation_id)
    ) or 0
    if assigned_count > 0:
        return False, f"Cannot delete designation: {assigned_count} employee(s) are currently assigned to it"

    db.delete(desig)
    db.commit()
    return True, None
