# src/repository/employee_repository.py
import datetime
from pathlib import Path
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session, joinedload
from database import SessionLocal
from models.employee import Employee
from models.department import Department
from models.designation import Designation
from models.user import User

BASE_DIR = Path(__file__).resolve().parent.parent


def _eager_options():
    """Standard eager-loading options for Employee queries."""
    return [
        joinedload(Employee.department),
        joinedload(Employee.designation),
        joinedload(Employee.reporting_manager),
    ]


def get_paginated(
    db: Session, skip: int = 0, limit: int | None = None
) -> tuple[int, list[Employee]]:
    """Fetches total count and paginated list of Employee ORM objects directly from PostgreSQL."""
    total = db.scalar(select(func.count()).select_from(Employee)) or 0

    stmt = (
        select(Employee)
        .options(*_eager_options())
        .order_by(Employee.emp_id)
        .offset(skip)
    )
    if limit is not None:
        stmt = stmt.limit(limit)

    items = list(db.scalars(stmt).unique().all())
    return total, items


def search(
    db: Session,
    first_name: str | None = None,
    last_name: str | None = None,
    dept_id: int | None = None,
    designation_id: int | None = None,
    employee_status: str | None = None,
    employment_type: str | None = None,
    gender: str | None = None,
    min_joining_date: str | None = None,
    max_joining_date: str | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[int, list[Employee]]:
    """Searches employees using database-level filtering with ORM."""
    conditions = []
    if first_name and first_name.strip():
        conditions.append(Employee.first_name.ilike(f"%{first_name.strip()}%"))
    if last_name and last_name.strip():
        conditions.append(Employee.last_name.ilike(f"%{last_name.strip()}%"))
    if dept_id is not None:
        conditions.append(Employee.dept_id == dept_id)
    if designation_id is not None:
        conditions.append(Employee.designation_id == designation_id)
    if employee_status and employee_status.strip():
        conditions.append(
            func.lower(Employee.employee_status) == employee_status.strip().lower()
        )
    if employment_type and employment_type.strip():
        conditions.append(
            func.lower(Employee.employment_type) == employment_type.strip().lower()
        )
    if gender and gender.strip():
        conditions.append(func.lower(Employee.gender) == gender.strip().lower())
    if min_joining_date and min_joining_date.strip():
        try:
            min_d = datetime.date.fromisoformat(min_joining_date.strip())
            conditions.append(Employee.joining_date >= min_d)
        except ValueError:
            pass
    if max_joining_date and max_joining_date.strip():
        try:
            max_d = datetime.date.fromisoformat(max_joining_date.strip())
            conditions.append(Employee.joining_date <= max_d)
        except ValueError:
            pass

    count_stmt = select(func.count()).select_from(Employee)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(Employee)
        .options(*_eager_options())
        .order_by(Employee.emp_id)
        .offset(skip)
    )
    if conditions:
        stmt = stmt.where(*conditions)
    if limit is not None:
        stmt = stmt.limit(limit)

    items = list(db.scalars(stmt).unique().all())
    return total, items


def get_all(db: Session | None = None) -> list[Employee]:
    """Returns every employee ORM object directly from the database."""
    if db is not None:
        stmt = (
            select(Employee)
            .options(*_eager_options())
            .order_by(Employee.emp_id)
        )
        return list(db.scalars(stmt).unique().all())

    with SessionLocal() as session:
        return get_all(db=session)


def get_by_id(e_id: int, db: Session | None = None) -> Employee | None:
    """Returns the Employee ORM object matching internal emp_id."""
    if db is not None:
        stmt = (
            select(Employee)
            .options(*_eager_options())
            .where(Employee.emp_id == e_id)
        )
        return db.scalar(stmt)

    with SessionLocal() as session:
        return get_by_id(e_id, db=session)


def get_by_public_id(public_id: str, db: Session | None = None) -> Employee | None:
    """Returns the Employee ORM object matching the given public UUID."""
    if not public_id:
        return None
    if db is not None:
        stmt = (
            select(Employee)
            .options(*_eager_options())
            .where(Employee.public_id == public_id)
        )
        return db.scalar(stmt)

    with SessionLocal() as session:
        return get_by_public_id(public_id, db=session)


def get_by_code(code: str, db: Session | None = None) -> Employee | None:
    """Returns the Employee ORM object matching employee_code."""
    if not code:
        return None
    clean_code = code.strip().upper()
    if db is not None:
        stmt = (
            select(Employee)
            .options(*_eager_options())
            .where(func.upper(Employee.employee_code) == clean_code)
        )
        return db.scalar(stmt)

    with SessionLocal() as session:
        return get_by_code(code, db=session)


def get_by_email(email: str, db: Session | None = None) -> Employee | None:
    """Returns the Employee ORM object matching email (case-insensitive)."""
    if not email:
        return None
    clean_email = email.strip().lower()
    if db is not None:
        stmt = (
            select(Employee)
            .options(*_eager_options())
            .where(func.lower(Employee.email) == clean_email)
        )
        return db.scalar(stmt)

    with SessionLocal() as session:
        return get_by_email(email, db=session)


def get_direct_reports(
    manager_public_id: str, db: Session
) -> tuple[Employee | None, list[Employee]]:
    """Returns manager and list of direct reports, looked up by manager's public_id."""
    manager = get_by_public_id(manager_public_id, db=db)
    if not manager:
        return None, []
    stmt = (
        select(Employee)
        .options(*_eager_options())
        .where(Employee.reporting_manager_id == manager.emp_id)
        .order_by(Employee.emp_id)
    )
    reports = list(db.scalars(stmt).unique().all())
    return manager, reports


def create_employee(
    db: Session,
    first_name: str,
    last_name: str,
    date_of_birth: str,
    gender: str,
    email: str,
    phone: str,
    joining_date: str,
    employee_status: str = "active",
    employment_type: str = "full_time",
    dept_id: int | None = None,
    designation_id: int | None = None,
    reporting_manager_id: int | None = None,
    is_active: bool = True,
    employee_code: str | None = None,
) -> Employee:
    """Creates a new Employee and associated User record transactionally in PostgreSQL."""
    clean_email = email.strip().lower()

    # 1. Get or create associated User
    user = db.scalar(select(User).where(func.lower(User.email) == clean_email))
    if not user:
        user = User(
            email=clean_email,
            display_name=f"{first_name.strip()} {last_name.strip()}",
            password_hash="temp_hash",
            is_active=is_active,
        )
        db.add(user)
        db.flush()

    # 2. Generate unique employee code if not provided
    if not employee_code:
        max_id = db.scalar(select(func.max(Employee.emp_id))) or 0
        code = f"EMP-{1000 + max_id + 1}"
    else:
        code = employee_code.strip().upper()

    # 3. Parse dates
    dob_date = (
        datetime.date.fromisoformat(date_of_birth.strip())
        if isinstance(date_of_birth, str)
        else date_of_birth
    )
    join_date = (
        datetime.date.fromisoformat(joining_date.strip())
        if isinstance(joining_date, str)
        else joining_date
    )

    # 4. Create Employee record
    emp = Employee(
        employee_code=code,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        date_of_birth=dob_date,
        gender=gender.strip().lower(),
        email=clean_email,
        phone=phone.strip(),
        joining_date=join_date,
        employee_status=employee_status.strip().lower(),
        employment_type=employment_type.strip().lower(),
        dept_id=dept_id,
        designation_id=designation_id,
        reporting_manager_id=reporting_manager_id,
        user_id=user.user_id,
        is_active=is_active,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


def update_employee(
    db: Session,
    e_id: int,
    first_name: str,
    last_name: str,
    date_of_birth: str,
    gender: str,
    email: str,
    phone: str,
    joining_date: str,
    employee_status: str = "active",
    employment_type: str = "full_time",
    dept_id: int | None = None,
    designation_id: int | None = None,
    reporting_manager_id: int | None = None,
    is_active: bool = True,
    employee_code: str | None = None,
) -> Employee | None:
    """Updates an existing employee record transactionally."""
    stmt = select(Employee).where(Employee.emp_id == e_id)
    emp = db.scalar(stmt)
    if not emp:
        return None

    emp.first_name = first_name.strip()
    emp.last_name = last_name.strip()
    emp.date_of_birth = (
        datetime.date.fromisoformat(date_of_birth.strip())
        if isinstance(date_of_birth, str)
        else date_of_birth
    )
    emp.gender = gender.strip().lower()
    emp.email = email.strip().lower()
    emp.phone = phone.strip()
    emp.joining_date = (
        datetime.date.fromisoformat(joining_date.strip())
        if isinstance(joining_date, str)
        else joining_date
    )
    emp.employee_status = employee_status.strip().lower()
    emp.employment_type = employment_type.strip().lower()
    emp.dept_id = dept_id
    emp.designation_id = designation_id
    emp.reporting_manager_id = reporting_manager_id
    emp.is_active = is_active
    if employee_code:
        emp.employee_code = employee_code.strip().upper()
    emp.updated_at = datetime.datetime.now()

    db.commit()
    db.refresh(emp)
    return emp


def delete_employee(db: Session, e_id: int) -> bool:
    """Deletes an employee from the database, handling relations properly."""
    emp = db.scalar(select(Employee).where(Employee.emp_id == e_id))
    if not emp:
        return False

    # Nullify reporting_manager_id on direct reports
    db.execute(
        text("UPDATE employees SET reporting_manager_id = NULL WHERE reporting_manager_id = :e_id"),
        {"e_id": e_id},
    )

    # Nullify head_employee_id on departments
    db.execute(
        text("UPDATE departments SET head_employee_id = NULL WHERE head_employee_id = :e_id"),
        {"e_id": e_id},
    )

    db.delete(emp)
    db.commit()
    return True