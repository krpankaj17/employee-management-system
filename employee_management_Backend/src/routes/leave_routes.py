# src/routes/leave_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import get_current_user, require_permission
from models.user import User
from schemas.leave_schema import (
    LeaveTypeIn,
    LeaveTypeOut,
    LeaveBalanceIn,
    LeaveBalanceOut,
    LeaveRequestIn,
    LeaveApprovalActionIn,
    LeaveRequestOut,
    PaginatedLeaveRequests,
)
from services import leave_service

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


@router.get("/types", response_model=list[LeaveTypeOut], dependencies=[Depends(require_permission("leave:read"))])
def list_leave_types(db: Session = Depends(get_db)):
    """Lists all configured leave types. Requires 'leave:read' permission."""
    return leave_service.get_all_leave_types(db=db)


@router.post("/types", response_model=LeaveTypeOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("leave:approve"))])
def create_leave_type(payload: LeaveTypeIn, db: Session = Depends(get_db)):
    """Creates a new leave type. Requires 'leave:approve' permission."""
    result = leave_service.create_leave_type(payload, db=db)
    if not result["ok"]:
        code = 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["leave_type"]


@router.get("/balances/{employee_public_id}", response_model=list[LeaveBalanceOut])
def get_employee_leave_balances(
    employee_public_id: str,
    year: int = Query(2026, ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves allocated, used, and remaining leave balances for an employee.
    Employees can view their own balance, or managers/HR with 'leave:read' permission."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("leave:read") or current_user.has_permission("leave:approve")

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view leave balances for this employee",
        )

    result = leave_service.get_employee_leave_balances(employee_public_id, year=year, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result["balances"]


@router.post("/allocate", response_model=LeaveBalanceOut, dependencies=[Depends(require_permission("leave:approve"))])
def allocate_leave_balance(payload: LeaveBalanceIn, db: Session = Depends(get_db)):
    """Allocates annual leave quota for an employee. Requires 'leave:approve' permission."""
    result = leave_service.allocate_leave_balance(payload, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["balance"]


@router.post("/requests", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    payload: LeaveRequestIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits a leave request with balance verification."""
    submitting_emp_id = current_user.employee.emp_id if current_user.employee else None
    result = leave_service.submit_leave_request(payload, submitting_emp_id=submitting_emp_id, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["request"]


@router.get("/requests", response_model=PaginatedLeaveRequests)
def list_leave_requests(
    employee_public_id: str | None = Query(None, description="Filter by employee UUID"),
    status_filter: str | None = Query(None, description="Filter: pending, approved, rejected, cancelled"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists leave requests with filters and pagination.
    Employees see their own requests; managers/HR with 'leave:read' can list company-wide."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("leave:read") or current_user.has_permission("leave:approve")

    if not has_perm:
        if not user_emp_public_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No employee profile linked to your user account",
            )
        # Force filter to only own requests
        employee_public_id = user_emp_public_id

    return leave_service.get_leave_requests(
        employee_public_id=employee_public_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get("/requests/{public_id}", response_model=LeaveRequestOut)
def get_leave_request_detail(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves full details of a leave request including its approval history trail.
    Employees can view their own requests; managers/HR require 'leave:read'."""
    req = leave_service.get_leave_request_detail(public_id, db=db)
    if not req:
        raise HTTPException(status_code=404, detail=f"Leave request with public_id '{public_id}' not found")

    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("leave:read") or current_user.has_permission("leave:approve")

    if not has_perm and req.get("employee_public_id") != user_emp_public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this leave request",
        )

    return req


@router.post("/requests/{public_id}/action", response_model=LeaveRequestOut, dependencies=[Depends(require_permission("leave:approve"))])
def process_leave_action(
    public_id: str,
    payload: LeaveApprovalActionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approves, rejects, or escalates a leave request. Self-approval is strictly prohibited."""
    actor_emp_id = current_user.employee.emp_id if current_user.employee else None
    if not actor_emp_id:
        raise HTTPException(status_code=403, detail="Only registered employee profiles can approve leaves")

    result = leave_service.process_leave_approval(public_id, action_by_emp_id=actor_emp_id, payload=payload, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "forbidden": 403, "validation": 400}
        code = code_map.get(result["error"], 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["request"]


@router.post("/requests/{public_id}/cancel", response_model=LeaveRequestOut)
def cancel_leave(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancels a leave request and refunds balance if previously approved."""
    actor_emp_id = current_user.employee.emp_id if current_user.employee else 0
    result = leave_service.cancel_leave_request(public_id, action_by_emp_id=actor_emp_id, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["request"]
