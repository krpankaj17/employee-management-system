# src/repository/department_repo.py
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from models.department import Department
from models.employee import Employee


def get_paginated(
    db: Session, skip: int = 0, limit: int | None = None
) -> tuple[int, list[Department]]:
    """Fetches total count and paginated list of departments."""
    total = db.scalar(select(func.count()).select_from(Department)) or 0
    stmt = select(Department).order_by(Department.dept_id).offset(skip)
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list(db.scalars(stmt).all())
    return total, items


def get_all(db: Session) -> list[Department]:
    """Returns all departments."""
    stmt = select(Department).order_by(Department.dept_id)
    return list(db.scalars(stmt).all())


def get_by_id(dept_id: int, db: Session) -> Department | None:
    """Finds department by internal ID."""
    return db.scalar(select(Department).where(Department.dept_id == dept_id))


def get_by_public_id(public_id: str, db: Session) -> Department | None:
    """Finds department by public UUID."""
    if not public_id:
        return None
    return db.scalar(select(Department).where(Department.public_id == public_id))


def get_by_name(dept_name: str, db: Session) -> Department | None:
    """Finds department by name (case-insensitive)."""
    if not dept_name:
        return None
    return db.scalar(select(Department).where(func.lower(Department.dept_name) == dept_name.strip().lower()))


def get_by_code(dept_code: str, db: Session) -> Department | None:
    """Finds department by code (case-insensitive)."""
    if not dept_code:
        return None
    return db.scalar(select(Department).where(func.upper(Department.dept_code) == dept_code.strip().upper()))


def create_department(
    dept_name: str,
    dept_code: str,
    db: Session,
    description: str | None = None,
    head_employee_id: int | None = None,
) -> Department:
    """Creates a new department directly in PostgreSQL."""
    dept = Department(
        dept_name=dept_name.strip(),
        dept_code=dept_code.strip().upper(),
        description=description.strip() if description else None,
        head_employee_id=head_employee_id,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def update_department(
    public_id: str,
    dept_name: str,
    dept_code: str,
    db: Session,
    description: str | None = None,
    head_employee_id: int | None = None,
) -> Department | None:
    """Updates department details."""
    dept = get_by_public_id(public_id, db=db)
    if not dept:
        return None

    dept.dept_name = dept_name.strip()
    dept.dept_code = dept_code.strip().upper()
    dept.description = description.strip() if description else None
    dept.head_employee_id = head_employee_id
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(public_id: str, db: Session) -> tuple[bool, str | None]:
    """Deletes a department. Blocks deletion if employees are currently assigned."""
    dept = get_by_public_id(public_id, db=db)
    if not dept:
        return False, "Department not found"

    assigned_count = db.scalar(
        select(func.count()).select_from(Employee).where(Employee.dept_id == dept.dept_id)
    ) or 0
    if assigned_count > 0:
        return False, f"Cannot delete department: {assigned_count} employee(s) are currently assigned to it"

    db.delete(dept)
    db.commit()
    return True, None


def get_department_employees(
    dept_id: int, db: Session, skip: int = 0, limit: int | None = None
) -> tuple[int, list[Employee]]:
    """Returns total count and paginated list of employees in a department."""
    total = db.scalar(
        select(func.count()).select_from(Employee).where(Employee.dept_id == dept_id)
    ) or 0
    stmt = (
        select(Employee)
        .where(Employee.dept_id == dept_id)
        .order_by(Employee.emp_id)
        .offset(skip)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list(db.scalars(stmt).all())
    return total, items
