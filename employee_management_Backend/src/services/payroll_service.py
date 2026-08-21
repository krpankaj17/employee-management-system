# src/services/payroll_service.py
import datetime
from decimal import Decimal
from uuid import uuid4
from typing import Any, cast
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.payroll import Salary, SalaryComponent, BankDetail, PayrollRun
from models.employee import Employee
from models.attendance import Attendance
from repository import payroll_repo as repo
from repository import employee_repository as emp_repo
from repository import attendance_repository as att_repo
from schemas.payroll_schema import (
    SalaryCreateIn,
    BankDetailIn,
    PayrollProcessIn,
    PayrollDisburseIn,
)
from utils.logger import log_action


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_employee(public_id: str, db: Session) -> tuple[Employee | None, str | None]:
    """Resolves an employee by public UUID and returns (Employee, error_message)."""
    if not public_id:
        return None, "Employee public_id is required"
    emp = emp_repo.get_by_public_id(public_id, db=db)
    if emp is None:
        return None, f"Employee with public_id '{public_id}' not found"
    return emp, None


def _mask_account(account: str) -> str:
    """Masks a bank account number showing only the last 4 digits."""
    if not account:
        return ""
    if len(account) <= 4:
        return account
    return "*" * (len(account) - 4) + account[-4:]


# ─── Salary Structure Service ──────────────────────────────────────────────────

def create_salary_structure(payload: SalaryCreateIn, db: Session) -> dict[str, Any]:
    """Creates a new salary revision for an employee, automatically auto-closing
    prior active salary to strictly avoid PostgreSQL GiST exclusion conflicts."""
    emp, err = _resolve_employee(payload.employee_public_id, db)
    if err or emp is None:
        return {"ok": False, "error": "not_found", "message": err}

    if payload.basic_salary < 0:
        return {
            "ok": False,
            "error": "validation",
            "message": "Basic salary cannot be negative",
        }

    # Calculate earnings and deductions
    total_earnings = Decimal("0.00")
    total_deductions = Decimal("0.00")
    components_to_create: list[SalaryComponent] = []

    for c in payload.components:
        if c.amount < 0:
            return {
                "ok": False,
                "error": "validation",
                "message": f"Component '{c.component_name}' amount cannot be negative",
            }
        if c.component_type == "earning":
            total_earnings += c.amount
        elif c.component_type == "deduction":
            total_deductions += c.amount
        else:
            return {
                "ok": False,
                "error": "validation",
                "message": f"Invalid component type '{c.component_type}'. Must be 'earning' or 'deduction'",
            }

        comp_model = SalaryComponent(
            component_name=c.component_name.strip(),
            component_type=c.component_type,
            amount=c.amount,
        )
        components_to_create.append(comp_model)

    net_salary = payload.basic_salary + total_earnings - total_deductions
    if net_salary < 0:
        return {
            "ok": False,
            "error": "validation",
            "message": f"Net salary ({net_salary}) cannot be negative after deductions",
        }

    try:
        # Auto-close previous salary to avoid GiST date range collisions
        repo.close_previous_salary(cast(int, emp.emp_id), payload.effective_from, db=db)

        salary = Salary(
            emp_id=cast(int, emp.emp_id),
            basic_salary=payload.basic_salary,
            net_salary=net_salary,
            currency=payload.currency.strip().upper(),
            effective_from=payload.effective_from,
            effective_to=None,
        )

        saved_salary = repo.create_salary(
            salary=salary, components=components_to_create, db=db
        )
        db.commit()

        log_action(
            "SALARY_CREATED",
            f"Created salary revision for employee {emp.employee_code} (Basic: {payload.basic_salary}, Net: {net_salary} {payload.currency})",
        )
        return {"ok": True, "salary": saved_salary.to_dict()}

    except Exception as e:
        db.rollback()
        return {
            "ok": False,
            "error": "conflict",
            "message": f"Failed to save salary revision: {str(e)}",
        }


def get_employee_salary_history(
    employee_public_id: str, db: Session
) -> dict[str, Any]:
    """Retrieves current active salary structure and complete history for an employee."""
    emp, err = _resolve_employee(employee_public_id, db)
    if err or emp is None:
        return {"ok": False, "error": "not_found", "message": err}

    active_salary = repo.get_active_salary(cast(int, emp.emp_id), on_date=datetime.date.today(), db=db)
    history = repo.get_salary_history(cast(int, emp.emp_id), db=db)

    return {
        "ok": True,
        "data": {
            "employee_public_id": str(emp.public_id),
            "employee_name": f"{emp.first_name} {emp.last_name}".strip(),
            "employee_code": emp.employee_code,
            "active_salary": active_salary.to_dict() if active_salary else None,
            "history": [s.to_dict() for s in history],
        },
    }


# ─── Bank Details Service ──────────────────────────────────────────────────────

def add_bank_detail(payload: BankDetailIn, db: Session) -> dict[str, Any]:
    """Adds a bank account for an employee and handles primary account designation."""
    emp, err = _resolve_employee(payload.employee_public_id, db)
    if err or emp is None:
        return {"ok": False, "error": "not_found", "message": err}

    routing_code = payload.routing_code.strip().upper()
    if len(routing_code) < 4:
        return {
            "ok": False,
            "error": "validation",
            "message": "Routing / IFSC code must be at least 4 characters long",
        }

    try:
        if payload.is_primary:
            repo.clear_primary_bank_details(cast(int, emp.emp_id), db=db)

        bank_record = BankDetail(
            emp_id=cast(int, emp.emp_id),
            bank_name=payload.bank_name.strip(),
            branch_name=payload.branch_name.strip() if payload.branch_name else None,
            account_number=payload.account_number.strip(),
            routing_code=routing_code,
            account_type=payload.account_type,
            is_primary=payload.is_primary,
        )

        saved = repo.create_bank_detail(bank_record, db=db)
        db.commit()

        log_action(
            "BANK_DETAIL_ADDED",
            f"Added {payload.account_type} bank account ({payload.bank_name}) for employee {emp.employee_code}",
        )
        return {"ok": True, "bank_detail": saved.to_dict()}

    except Exception as e:
        db.rollback()
        return {
            "ok": False,
            "error": "db_error",
            "message": f"Failed to save bank account: {str(e)}",
        }


def get_employee_bank_details(
    employee_public_id: str, db: Session
) -> dict[str, Any]:
    """Fetches list of registered bank accounts for an employee."""
    emp, err = _resolve_employee(employee_public_id, db)
    if err or emp is None:
        return {"ok": False, "error": "not_found", "message": err}

    accounts = repo.get_bank_details(cast(int, emp.emp_id), db=db)
    return {
        "ok": True,
        "items": [a.to_dict() for a in accounts],
    }


# ─── Payroll Processing & Disbursement Service ─────────────────────────────────

def process_payroll_batch(payload: PayrollProcessIn, db: Session) -> dict[str, Any]:
    """Executes a payroll processing run for a given date cycle across target active employees."""
    if payload.pay_period_end < payload.pay_period_start:
        return {
            "ok": False,
            "error": "validation",
            "message": "pay_period_end cannot be before pay_period_start",
        }

    # Determine employees to process
    target_employees: list[Employee] = []
    if payload.employee_public_id:
        emp, err = _resolve_employee(payload.employee_public_id, db)
        if err or emp is None:
            return {"ok": False, "error": "not_found", "message": err}
        target_employees = [emp]
    else:
        # Get all active employees
        _, target_employees = emp_repo.search(db=db, employee_status="active", limit=1000)

    if not target_employees:
        return {
            "ok": False,
            "error": "not_found",
            "message": "No active employees found to process payroll for",
        }

    created_runs: list[dict[str, Any]] = []
    skipped_employees: list[dict[str, str]] = []

    for emp in target_employees:
        # Check if payroll run already exists for this exact employee and period
        existing = repo.check_existing_payroll_run(
            emp_id=cast(int, emp.emp_id),
            period_start=payload.pay_period_start,
            period_end=payload.pay_period_end,
            db=db,
        )
        if existing:
            skipped_employees.append(
                {
                    "employee_code": cast(str, emp.employee_code),
                    "reason": f"Payroll run already exists for period {payload.pay_period_start} to {payload.pay_period_end}",
                }
            )
            continue

        # Get active salary structure as of pay_period_end
        active_salary = repo.get_active_salary(
            emp_id=cast(int, emp.emp_id), on_date=payload.pay_period_end, db=db
        )
        if not active_salary:
            skipped_employees.append(
                {
                    "employee_code": cast(str, emp.employee_code),
                    "reason": f"No active salary structure found on date {payload.pay_period_end}",
                }
            )
            continue

        # Calculate gross earnings and deductions from salary structure
        earnings_sum = sum(
            c.amount for c in active_salary.components if c.component_type == "earning"
        )
        deductions_sum = sum(
            c.amount for c in active_salary.components if c.component_type == "deduction"
        )
        gross_amount = active_salary.basic_salary + Decimal(str(earnings_sum))
        total_deductions = Decimal(str(deductions_sum))
        net_paid = gross_amount - total_deductions
        if net_paid < 0:
            net_paid = Decimal("0.00")

        # Create PayrollRun
        payroll_run = PayrollRun(
            emp_id=cast(int, emp.emp_id),
            salary_id=cast(int, active_salary.salary_id),
            pay_period_start=payload.pay_period_start,
            pay_period_end=payload.pay_period_end,
            gross_amount=gross_amount,
            total_deductions=total_deductions,
            net_paid=net_paid,
            payment_status="pending",
            payment_date=None,
            payment_method=None,
            transaction_ref=None,
        )
        repo.create_payroll_run(payroll_run, db=db)
        created_runs.append(payroll_run.to_dict())

    try:
        db.commit()
        log_action(
            "PAYROLL_PROCESSED",
            f"Processed payroll batch for period {payload.pay_period_start} to {payload.pay_period_end} ({len(created_runs)} created, {len(skipped_employees)} skipped)",
        )
        return {
            "ok": True,
            "summary": {
                "period_start": payload.pay_period_start.isoformat(),
                "period_end": payload.pay_period_end.isoformat(),
                "total_processed": len(created_runs),
                "total_skipped": len(skipped_employees),
                "runs": created_runs,
                "skipped": skipped_employees,
            },
        }
    except Exception as e:
        db.rollback()
        return {
            "ok": False,
            "error": "db_error",
            "message": f"Failed to commit payroll batch: {str(e)}",
        }


def get_payroll_runs_paginated(
    skip: int = 0,
    limit: int | None = None,
    employee_public_id: str | None = None,
    payment_status: str | None = None,
    pay_period_start: datetime.date | None = None,
    pay_period_end: datetime.date | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    """Returns paginated payroll runs with detailed employee info."""
    assert db is not None, "db session is required"
    emp_id = None
    if employee_public_id:
        emp, err = _resolve_employee(employee_public_id, db)
        if err or emp is None:
            return {"ok": False, "error": "not_found", "message": err}
        emp_id = cast(int, emp.emp_id)

    total, items = repo.get_payroll_runs(
        skip=skip,
        limit=limit,
        emp_id=emp_id,
        payment_status=payment_status,
        pay_period_start=pay_period_start,
        pay_period_end=pay_period_end,
        db=db,
    )

    formatted_items = []
    for r in items:
        emp = r.employee
        dept_name = emp.department.dept_name if emp and emp.department else None
        desig_title = emp.designation.title if emp and emp.designation else None
        formatted_items.append(
            {
                "public_id": str(r.public_id),
                "employee_public_id": str(emp.public_id) if emp else "",
                "employee_name": f"{emp.first_name} {emp.last_name}".strip() if emp else "",
                "employee_code": emp.employee_code if emp else "",
                "department_name": dept_name,
                "designation_title": desig_title,
                "pay_period_start": r.pay_period_start.isoformat() if hasattr(r.pay_period_start, "isoformat") else str(r.pay_period_start),
                "pay_period_end": r.pay_period_end.isoformat() if hasattr(r.pay_period_end, "isoformat") else str(r.pay_period_end),
                "gross_amount": float(cast(Decimal, r.gross_amount)),
                "total_deductions": float(cast(Decimal, r.total_deductions)),
                "net_paid": float(cast(Decimal, r.net_paid)),
                "payment_status": r.payment_status,
                "payment_date": r.payment_date.isoformat() if r.payment_date and hasattr(r.payment_date, "isoformat") else None,
                "payment_method": r.payment_method,
                "transaction_ref": r.transaction_ref,
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
            }
        )

    return {
        "ok": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": formatted_items,
    }


def get_payslip_detail(payroll_public_id: str, db: Session) -> dict[str, Any]:
    """Generates complete itemized payslip breakdown for a payroll run."""
    run = repo.get_payroll_run_by_public_id(payroll_public_id, db=db)
    if not run:
        return {
            "ok": False,
            "error": "not_found",
            "message": f"Payroll run '{payroll_public_id}' not found",
        }

    emp = run.employee
    salary = run.salary
    primary_bank = repo.get_primary_bank_detail(cast(int, run.emp_id), db=db)

    # Attendance statistics during the pay period
    total_days = (run.pay_period_end - run.pay_period_start).days + 1
    att_stmt = select(Attendance).where(
        Attendance.emp_id == run.emp_id,
        Attendance.date >= run.pay_period_start,
        Attendance.date <= run.pay_period_end,
    )
    att_records = list(db.scalars(att_stmt).all())

    days_present = sum(1 for a in att_records if a.status == "present")
    days_half_day = sum(1 for a in att_records if a.status == "half_day")
    days_on_leave = sum(1 for a in att_records if a.status == "on_leave")
    days_absent = sum(1 for a in att_records if a.status == "absent")

    earnings = []
    deductions = []
    if salary and salary.components:
        for c in salary.components:
            item = {
                "component_id": c.component_id,
                "component_name": c.component_name,
                "component_type": c.component_type,
                "amount": float(cast(Decimal, c.amount)),
            }
            if c.component_type == "earning":
                earnings.append(item)
            else:
                deductions.append(item)

    payslip = {
        "payroll_public_id": str(run.public_id),
        "employee_public_id": str(emp.public_id) if emp else "",
        "employee_name": f"{emp.first_name} {emp.last_name}".strip() if emp else "",
        "employee_code": emp.employee_code if emp else "",
        "email": emp.email if emp else "",
        "department": emp.department.dept_name if emp and emp.department else None,
        "designation": emp.designation.title if emp and emp.designation else None,
        "bank_account_masked": _mask_account(cast(str, primary_bank.account_number)) if primary_bank else None,
        "bank_name": primary_bank.bank_name if primary_bank else None,
        "pay_period_start": run.pay_period_start.isoformat() if hasattr(run.pay_period_start, "isoformat") else str(run.pay_period_start),
        "pay_period_end": run.pay_period_end.isoformat() if hasattr(run.pay_period_end, "isoformat") else str(run.pay_period_end),
        "days_in_period": total_days,
        "days_present": days_present,
        "days_half_day": days_half_day,
        "days_on_leave": days_on_leave,
        "days_absent": days_absent,
        "basic_salary": float(cast(Decimal, salary.basic_salary)) if salary else float(cast(Decimal, run.gross_amount)),
        "earnings_breakdown": earnings,
        "deductions_breakdown": deductions,
        "gross_amount": float(cast(Decimal, run.gross_amount)),
        "total_deductions": float(cast(Decimal, run.total_deductions)),
        "net_paid": float(cast(Decimal, run.net_paid)),
        "payment_status": run.payment_status,
        "payment_date": run.payment_date.isoformat() if run.payment_date and hasattr(run.payment_date, "isoformat") else None,
        "payment_method": run.payment_method,
        "transaction_ref": run.transaction_ref,
        "created_at": run.created_at.isoformat() if hasattr(run.created_at, "isoformat") else str(run.created_at),
    }

    return {"ok": True, "payslip": payslip}


def disburse_payroll_run(
    payroll_public_id: str, payload: PayrollDisburseIn, db: Session
) -> dict[str, Any]:
    """Marks a payroll run as paid and records transaction disbursement details."""
    run = repo.get_payroll_run_by_public_id(payroll_public_id, db=db)
    if not run:
        return {
            "ok": False,
            "error": "not_found",
            "message": f"Payroll run '{payroll_public_id}' not found",
        }

    if run.payment_status == "paid":
        return {
            "ok": False,
            "error": "conflict",
            "message": f"Payroll run is already paid on {run.payment_date} (Ref: {run.transaction_ref})",
        }

    pay_date = payload.payment_date or datetime.date.today()
    txn_ref = payload.transaction_ref or f"TXN-{uuid4().hex[:12].upper()}"

    run.payment_status = "paid"
    run.payment_date = pay_date
    run.payment_method = payload.payment_method
    run.transaction_ref = txn_ref

    try:
        repo.update_payroll_run(run, db=db)
        db.commit()

        emp_code = run.employee.employee_code if run.employee else f"ID {run.emp_id}"
        log_action(
            "PAYROLL_DISBURSED",
            f"Disbursed {run.net_paid} to employee {emp_code} via {payload.payment_method} (Ref: {txn_ref})",
        )
        return {
            "ok": True,
            "message": "Payroll disbursement recorded successfully",
            "payroll_run": run.to_dict(),
        }
    except Exception as e:
        db.rollback()
        return {
            "ok": False,
            "error": "db_error",
            "message": f"Failed to record disbursement: {str(e)}",
        }
