# src/repository/payroll_repo.py
from datetime import date, timedelta
from typing import cast
from sqlalchemy import select, func, or_, and_, update
from sqlalchemy.orm import Session, joinedload
from models.payroll import Salary, SalaryComponent, BankDetail, PayrollRun
from models.employee import Employee


# ─── Salary Repository ──────────────────────────────────────────────────────────

def _salary_options():
    return [
        joinedload(Salary.components),
        joinedload(Salary.employee),
    ]


def get_salary_by_public_id(public_id: str, db: Session) -> Salary | None:
    """Fetches a Salary by its public UUID with eager-loaded components and employee."""
    if not public_id:
        return None
    stmt = (
        select(Salary)
        .options(*_salary_options())
        .where(Salary.public_id == public_id)
    )
    return db.scalar(stmt)


def get_active_salary(emp_id: int, on_date: date | None, db: Session) -> Salary | None:
    """Fetches the active salary revision for an employee on a given date (defaulting to today)."""
    target_date = on_date or date.today()
    stmt = (
        select(Salary)
        .options(*_salary_options())
        .where(
            Salary.emp_id == emp_id,
            Salary.effective_from <= target_date,
            or_(Salary.effective_to.is_(None), Salary.effective_to >= target_date),
        )
        .order_by(Salary.effective_from.desc())
    )
    return db.scalar(stmt)


def get_salary_history(emp_id: int, db: Session) -> list[Salary]:
    """Fetches full salary history for an employee ordered chronologically."""
    stmt = (
        select(Salary)
        .options(*_salary_options())
        .where(Salary.emp_id == emp_id)
        .order_by(Salary.effective_from.desc(), Salary.salary_id.desc())
    )
    return list(db.scalars(stmt).unique().all())


def close_previous_salary(emp_id: int, new_effective_from: date, db: Session) -> None:
    """Closes any existing open-ended or overlapping salary to satisfy GiST exclusion."""
    prev_end_date = new_effective_from - timedelta(days=1)

    # 1. Delete any existing revisions for this employee starting on or after new_effective_from
    same_or_later = db.scalars(
        select(Salary).where(
            Salary.emp_id == emp_id,
            Salary.effective_from >= new_effective_from,
        )
    ).all()
    for s in same_or_later:
        db.delete(s)

    # 2. Cap any prior active/overlapping salary records to end the day before new_effective_from
    stmt = (
        select(Salary)
        .where(
            Salary.emp_id == emp_id,
            Salary.effective_from < new_effective_from,
            or_(
                Salary.effective_to.is_(None),
                Salary.effective_to >= new_effective_from,
            ),
        )
    )
    salaries_to_close = db.scalars(stmt).all()
    for s in salaries_to_close:
        s.effective_to = prev_end_date
    db.flush()



def create_salary(
    salary: Salary, components: list[SalaryComponent], db: Session
) -> Salary:
    """Persists a new salary revision along with its itemized components."""
    db.add(salary)
    db.flush()  # Generates salary.salary_id

    for comp in components:
        comp.salary_id = salary.salary_id
        db.add(comp)
    db.flush()

    # Refresh with eager load
    db.refresh(salary)
    return salary


# ─── Bank Details Repository ───────────────────────────────────────────────────

def get_bank_details(emp_id: int, db: Session) -> list[BankDetail]:
    """Returns all bank account details registered for an employee."""
    stmt = (
        select(BankDetail)
        .options(joinedload(BankDetail.employee))
        .where(BankDetail.emp_id == emp_id)
        .order_by(BankDetail.is_primary.desc(), BankDetail.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_bank_detail_by_public_id(public_id: str, db: Session) -> BankDetail | None:
    """Fetches a BankDetail record by its public UUID."""
    if not public_id:
        return None
    stmt = (
        select(BankDetail)
        .options(joinedload(BankDetail.employee))
        .where(BankDetail.public_id == public_id)
    )
    return db.scalar(stmt)


def get_primary_bank_detail(emp_id: int, db: Session) -> BankDetail | None:
    """Fetches the primary bank account for an employee."""
    stmt = (
        select(BankDetail)
        .where(BankDetail.emp_id == emp_id, BankDetail.is_primary.is_(True))
    )
    return db.scalar(stmt)


def clear_primary_bank_details(emp_id: int, db: Session) -> None:
    """Sets is_primary = False for all existing bank accounts of an employee."""
    stmt = (
        update(BankDetail)
        .where(BankDetail.emp_id == emp_id, BankDetail.is_primary.is_(True))
        .values(is_primary=False)
    )
    db.execute(stmt)
    db.flush()


def create_bank_detail(detail: BankDetail, db: Session) -> BankDetail:
    """Adds a new bank detail entry."""
    db.add(detail)
    db.flush()
    db.refresh(detail)
    return detail


# ─── Payroll Runs Repository ───────────────────────────────────────────────────

def _payroll_options():
    return [
        joinedload(PayrollRun.employee).joinedload(Employee.department),
        joinedload(PayrollRun.employee).joinedload(Employee.designation),
        joinedload(PayrollRun.salary).joinedload(Salary.components),
    ]


def get_payroll_runs(
    skip: int = 0,
    limit: int | None = None,
    emp_id: int | None = None,
    payment_status: str | None = None,
    pay_period_start: date | None = None,
    pay_period_end: date | None = None,
    db: Session | None = None,
) -> tuple[int, list[PayrollRun]]:
    """Fetches paginated payroll runs with optional employee and status filters."""
    assert db is not None, "db session is required"
    conditions = []
    if emp_id is not None:
        conditions.append(PayrollRun.emp_id == emp_id)
    if payment_status and payment_status.strip():
        conditions.append(
            func.lower(PayrollRun.payment_status) == payment_status.strip().lower()
        )
    if pay_period_start is not None:
        conditions.append(PayrollRun.pay_period_start >= pay_period_start)
    if pay_period_end is not None:
        conditions.append(PayrollRun.pay_period_end <= pay_period_end)

    count_stmt = select(func.count()).select_from(PayrollRun)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(PayrollRun)
        .options(*_payroll_options())
        .order_by(PayrollRun.pay_period_start.desc(), PayrollRun.payroll_id.desc())
        .offset(skip)
    )
    if conditions:
        stmt = stmt.where(*conditions)
    if limit is not None:
        stmt = stmt.limit(limit)

    items = list(db.scalars(stmt).unique().all())
    return total, items


def get_payroll_run_by_public_id(public_id: str, db: Session) -> PayrollRun | None:
    """Fetches a specific PayrollRun by public UUID with all relationships."""
    if not public_id:
        return None
    stmt = (
        select(PayrollRun)
        .options(*_payroll_options())
        .where(PayrollRun.public_id == public_id)
    )
    return db.scalar(stmt)


def check_existing_payroll_run(
    emp_id: int, period_start: date, period_end: date, db: Session
) -> PayrollRun | None:
    """Checks if a payroll run already exists for the given employee and exact date range."""
    stmt = select(PayrollRun).where(
        PayrollRun.emp_id == emp_id,
        PayrollRun.pay_period_start == period_start,
        PayrollRun.pay_period_end == period_end,
    )
    return db.scalar(stmt)


def create_payroll_run(run: PayrollRun, db: Session) -> PayrollRun:
    """Persists a new payroll run record."""
    db.add(run)
    db.flush()
    db.refresh(run)
    return run


def update_payroll_run(run: PayrollRun, db: Session) -> PayrollRun:
    """Updates an existing payroll run."""
    db.flush()
    db.refresh(run)
    return run
