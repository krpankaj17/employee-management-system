# src/routes/payroll_routes.py
from datetime import date
from typing import cast
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.payroll_schema import (
    SalaryCreateIn,
    SalaryOut,
    SalaryHistoryOut,
    BankDetailIn,
    BankDetailOut,
    PayrollProcessIn,
    PayrollRunOut,
    PayslipOut,
    PayrollDisburseIn,
    PaginatedPayrollRuns,
)
from services import payroll_service


router = APIRouter()

salary_router = APIRouter(prefix="/salaries", tags=["Compensation & Salaries"])
bank_router = APIRouter(prefix="/bank-details", tags=["Bank Details"])
payroll_router = APIRouter(prefix="/payroll", tags=["Payroll Management"])


# ─── 1. Compensation & Salary Endpoints ────────────────────────────────────────

@salary_router.post(
    "",
    response_model=SalaryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("salary:create"))],
)
def create_salary_revision(
    payload: SalaryCreateIn, db: Session = Depends(get_db)
):
    """Creates a new salary revision for an employee, automatically updating previous
    active revision's effective_to date to prevent PostgreSQL GiST date exclusion conflicts."""
    result = payroll_service.create_salary_structure(payload, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "validation": 400, "conflict": 409}
        code = code_map.get(result.get("error", "validation"), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["salary"]


@salary_router.get(
    "/{employee_public_id}",
    response_model=SalaryHistoryOut,
)
def get_employee_salaries(
    employee_public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves active salary structure and complete history for an employee.
    Allowed for HR/Admin managers with 'salary:read' or employee viewing own records."""
    # Check self or permission
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("salary:read")

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view salary details for this employee",
        )

    result = payroll_service.get_employee_salary_history(employee_public_id, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["data"]


# ─── 2. Bank Details Endpoints ─────────────────────────────────────────────────

@bank_router.post(
    "",
    response_model=BankDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def add_employee_bank_account(
    payload: BankDetailIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds a bank account for salary disbursement. Handles primary account designation."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("payroll:update") or current_user.has_permission("employee:update")

    if not has_perm and user_emp_public_id != payload.employee_public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify bank details for this employee",
        )

    result = payroll_service.add_bank_detail(payload, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "validation": 400, "db_error": 500}
        code = code_map.get(result.get("error", "validation"), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["bank_detail"]


@bank_router.get(
    "/{employee_public_id}",
    response_model=list[BankDetailOut],
)
def list_employee_bank_accounts(
    employee_public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists registered bank accounts for an employee. Allowed for HR/Admin or Owner."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("payroll:read") or current_user.has_permission("employee:read")

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view bank accounts for this employee",
        )

    result = payroll_service.get_employee_bank_details(employee_public_id, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["items"]


# ─── 3. Payroll Runs & Disbursement Endpoints ──────────────────────────────────

@payroll_router.post(
    "/process",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("payroll:run"))],
)
def process_payroll(
    payload: PayrollProcessIn,
    db: Session = Depends(get_db),
):
    """Triggers batch or single-employee payroll calculation for a pay cycle.
    Computes earnings, deductions, net pay, and generates pending payroll records."""
    result = payroll_service.process_payroll_batch(payload, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "validation": 400, "db_error": 500}
        code = code_map.get(result.get("error", "validation"), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["summary"]


@payroll_router.get(
    "/runs",
    response_model=PaginatedPayrollRuns,
    dependencies=[Depends(require_permission("payroll:read"))],
)
def list_payroll_runs(
    skip: int = Query(0, ge=0, description="Records to skip"),
    limit: int | None = Query(None, gt=0, description="Max records to return"),
    employee_public_id: str | None = Query(None, description="Filter by employee public UUID"),
    payment_status: str | None = Query(None, description="Filter by payment status (pending, paid, etc.)"),
    pay_period_start: date | None = Query(None, description="Filter from pay cycle start date"),
    pay_period_end: date | None = Query(None, description="Filter to pay cycle end date"),
    db: Session = Depends(get_db),
):
    """Lists payroll runs with filters and pagination. Requires 'payroll:read' permission."""
    result = payroll_service.get_payroll_runs_paginated(
        skip=skip,
        limit=limit,
        employee_public_id=employee_public_id,
        payment_status=payment_status,
        pay_period_start=pay_period_start,
        pay_period_end=pay_period_end,
        db=db,
    )
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to fetch payroll runs"))
    return result


@payroll_router.get(
    "/runs/{public_id}",
    response_model=PayslipOut,
)
def get_payslip(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves full itemized payslip breakdown. Allowed for HR/Admin or Owner employee."""
    result = payroll_service.get_payslip_detail(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])

    payslip = result["payslip"]
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("payroll:read")

    if not has_perm and user_emp_public_id != payslip.get("employee_public_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this payslip",
        )

    return payslip


@payroll_router.post(
    "/runs/{public_id}/disburse",
    response_model=PayrollRunOut,
    dependencies=[Depends(require_permission("payroll:run"))],
)
def disburse_payroll(
    public_id: str,
    payload: PayrollDisburseIn,
    db: Session = Depends(get_db),
):
    """Records payment disbursement for a payroll run, generating reference and marking paid."""
    result = payroll_service.disburse_payroll_run(public_id, payload=payload, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "conflict": 409, "db_error": 500}
        code = code_map.get(result.get("error", "validation"), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["payroll_run"]


# Include all sub-routers under master router
router.include_router(salary_router)
router.include_router(bank_router)
router.include_router(payroll_router)
