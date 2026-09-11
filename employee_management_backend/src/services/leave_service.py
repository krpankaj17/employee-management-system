# src/services/leave_service.py
import datetime
import utils
from sqlalchemy.orm import Session
from core.cache import get_cached_or_compute, invalidate_cache
from repository import leave_repo
from repository import employee_repository as emp_repo
from schemas.leave_schema import LeaveTypeIn, LeaveBalanceIn, LeaveRequestIn, LeaveApprovalActionIn


def get_all_leave_types(db: Session) -> list[dict]:
    def _fetch():
        types = leave_repo.get_all_leave_types(db)
        return [t.to_dict() for t in types]

    return get_cached_or_compute("leave_types", "all", _fetch)


def create_leave_type(payload: LeaveTypeIn, db: Session) -> dict:
    clean_name = payload.name.strip()
    existing = leave_repo.get_leave_type_by_name(clean_name, db=db)
    if existing:
        return {"ok": False, "error": "conflict", "message": f"Leave type '{clean_name}' already exists"}

    lt = leave_repo.create_leave_type(
        name=clean_name,
        description=payload.description,
        max_days_per_year=payload.max_days_per_year,
        is_paid=payload.is_paid,
        db=db,
    )

    # Auto-provision balances for existing employees for the current year
    try:
        current_year = datetime.date.today().year
        all_emps = emp_repo.get_all(db=db)
        for emp in all_emps:
            leave_repo.allocate_leave_balance(
                emp_id=emp.emp_id,
                leave_type_id=lt.leave_type_id,
                year=current_year,
                total_allocated=payload.max_days_per_year,
                db=db,
            )
    except Exception:
        pass

    invalidate_cache("leave_types")
    utils.log_action("LEAVE_TYPE_CREATED", f"name={lt.name} public_id={lt.public_id}")
    return {"ok": True, "leave_type": lt.to_dict()}


def update_leave_type(public_id: str, payload: LeaveTypeIn, db: Session) -> dict:
    lt = leave_repo.get_leave_type_by_public_id(public_id, db=db)
    if not lt:
        return {"ok": False, "error": "not_found", "message": f"Leave type '{public_id}' not found"}

    clean_name = payload.name.strip()
    if clean_name.lower() != lt.name.lower():
        existing = leave_repo.get_leave_type_by_name(clean_name, db=db)
        if existing:
            return {"ok": False, "error": "conflict", "message": f"Leave type '{clean_name}' already exists"}

    updated = leave_repo.update_leave_type(
        lt=lt,
        name=clean_name,
        description=payload.description,
        max_days_per_year=payload.max_days_per_year,
        is_paid=payload.is_paid,
        db=db,
    )
    invalidate_cache("leave_types")
    utils.log_action("LEAVE_TYPE_UPDATED", f"name={updated.name} public_id={updated.public_id}")
    return {"ok": True, "leave_type": updated.to_dict()}


def delete_leave_type(public_id: str, db: Session) -> dict:
    lt = leave_repo.get_leave_type_by_public_id(public_id, db=db)
    if not lt:
        return {"ok": False, "error": "not_found", "message": f"Leave type '{public_id}' not found"}

    try:
        leave_repo.delete_leave_type(lt, db=db)
        invalidate_cache("leave_types")
        utils.log_action("LEAVE_TYPE_DELETED", f"public_id={public_id}")
        return {"ok": True, "details": f"Leave type '{lt.name}' deleted", "message": f"Leave type '{lt.name}' deleted"}
    except Exception:
        db.rollback()
        return {
            "ok": False,
            "error": "conflict",
            "message": f"Cannot delete leave type '{lt.name}' because historical leave requests reference it.",
        }



def get_employee_leave_balances(employee_public_id: str, year: int, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}

    balances = leave_repo.get_employee_leave_balances(emp.emp_id, year=year, db=db)
    existing_type_ids = {b.leave_type_id for b in balances}
    all_types = leave_repo.get_all_leave_types(db=db)
    added = False
    for lt in all_types:
        if lt.leave_type_id not in existing_type_ids:
            leave_repo.allocate_leave_balance(
                emp_id=emp.emp_id,
                leave_type_id=lt.leave_type_id,
                year=year,
                total_allocated=lt.max_days_per_year,
                db=db,
            )
            added = True

    if added:
        balances = leave_repo.get_employee_leave_balances(emp.emp_id, year=year, db=db)

    return {"ok": True, "balances": [b.to_dict() for b in balances]}


def allocate_leave_balance(payload: LeaveBalanceIn, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(payload.employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{payload.employee_public_id}' not found"}

    lt = leave_repo.get_leave_type_by_public_id(payload.leave_type_public_id, db=db)
    if not lt:
        return {"ok": False, "error": "not_found", "message": f"Leave type with public_id '{payload.leave_type_public_id}' not found"}

    balance = leave_repo.allocate_leave_balance(
        emp_id=emp.emp_id,
        leave_type_id=lt.leave_type_id,
        year=payload.year,
        total_allocated=payload.total_allocated,
        db=db,
    )
    utils.log_action("LEAVE_ALLOCATED", f"emp={payload.employee_public_id} type={lt.name} days={payload.total_allocated}")
    return {"ok": True, "balance": balance.to_dict()}


def submit_leave_request(
    payload: LeaveRequestIn, submitting_emp_id: int | None, db: Session
) -> dict:
    """Submits a leave application with balance checks and date validations."""
    # Resolve target employee
    if payload.employee_public_id:
        emp = emp_repo.get_by_public_id(payload.employee_public_id, db=db)
        if not emp:
            return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{payload.employee_public_id}' not found"}
        target_emp_id = emp.emp_id
    elif submitting_emp_id:
        target_emp_id = submitting_emp_id
    else:
        return {"ok": False, "error": "validation", "message": "Target employee is required"}

    # Resolve leave type
    lt = leave_repo.get_leave_type_by_public_id(payload.leave_type_public_id, db=db)
    if not lt:
        return {"ok": False, "error": "not_found", "message": f"Leave type with public_id '{payload.leave_type_public_id}' not found"}

    # Validate dates
    if not utils.is_valid_date(payload.start_date) or not utils.is_valid_date(payload.end_date):
        return {"ok": False, "error": "validation", "message": "Invalid date format, expected YYYY-MM-DD"}

    start_d = datetime.date.fromisoformat(payload.start_date.strip())
    end_d = datetime.date.fromisoformat(payload.end_date.strip())
    if end_d < start_d:
        return {"ok": False, "error": "validation", "message": "End date must be on or after start date"}

    # Calculate duration in days (auto-calculate if omitted)
    days_requested = payload.total_days
    if days_requested is None or days_requested <= 0:
        days_requested = float((end_d - start_d).days + 1)

    # Check leave balance if paid leave
    if lt.is_paid:
        balance = leave_repo.get_employee_leave_balance(target_emp_id, lt.leave_type_id, start_d.year, db=db)
        if not balance:
            return {
                "ok": False,
                "error": "validation",
                "message": f"No leave balance allocated for '{lt.name}' in year {start_d.year}",
            }
        remaining = balance.total_allocated - balance.used_leaves
        if days_requested > remaining:
            return {
                "ok": False,
                "error": "validation",
                "message": f"Insufficient leave balance for '{lt.name}'. Requested: {days_requested}, Available: {remaining}",
            }

    req = leave_repo.create_leave_request(
        emp_id=target_emp_id,
        leave_type_id=lt.leave_type_id,
        start_date=start_d,
        end_date=end_d,
        total_days=days_requested,
        reason=payload.reason,
        db=db,
    )
    utils.log_action("LEAVE_REQUESTED", f"emp_id={target_emp_id} days={payload.total_days}")
    return {"ok": True, "request": req.to_dict()}


def process_leave_approval(
    leave_public_id: str,
    action_by_emp_id: int,
    payload: LeaveApprovalActionIn,
    db: Session,
    is_admin: bool = False,
) -> dict:
    """Processes manager/HR action (approve, reject, escalate). Prevents self-approval unless user is an Admin."""
    req = leave_repo.get_leave_request_by_public_id(leave_public_id, db=db)
    if not req:
        return {"ok": False, "error": "not_found", "message": f"Leave request with public_id '{leave_public_id}' not found"}

    if req.status != "pending":
        return {"ok": False, "error": "validation", "message": f"Leave request is already '{req.status}' and cannot be modified"}

    # Enforce policy against self-approval (Admin is permitted to accept/approve anyone's request, including their own)
    if action_by_emp_id == req.employee_id and not is_admin:
        return {"ok": False, "error": "forbidden", "message": "Self-approval of leave requests is strictly prohibited by policy"}

    action_clean = payload.action.strip().lower()
    if action_clean not in {"approved", "rejected", "escalated", "cancelled"}:
        return {"ok": False, "error": "validation", "message": "Invalid approval action"}

    if action_clean == "approved":
        # Deduct balance if paid
        if req.leave_type and req.leave_type.is_paid:
            leave_repo.deduct_leave_balance(
                emp_id=req.employee_id,
                leave_type_id=req.leave_type_id,
                year=req.start_date.year,
                days=int(req.total_days),
                db=db,
            )
        leave_repo.update_leave_request_status(
            leave_id=req.leave_id,
            status_val="approved",
            approved_by=action_by_emp_id,
            db=db,
        )
        # If the approved leave covers today, immediately update employee_status to 'on_leave'
        today = datetime.date.today()
        if req.start_date <= today <= req.end_date:
            emp = emp_repo.get_by_id(req.employee_id, db=db)
            if emp and emp.employee_status.lower() in ("active", "on_leave"):
                emp.employee_status = "on_leave"
                db.flush()
                invalidate_cache("employee_lists")
                if hasattr(emp, "public_id") and emp.public_id:
                    invalidate_cache("employee_profiles", str(emp.public_id))
    elif action_clean == "rejected":
        leave_repo.update_leave_request_status(
            leave_id=req.leave_id,
            status_val="rejected",
            approved_by=action_by_emp_id,
            rejection_reason=payload.rejection_reason or payload.remarks,
            db=db,
        )
    else:
        leave_repo.update_leave_request_status(
            leave_id=req.leave_id,
            status_val=action_clean,
            approved_by=action_by_emp_id,
            db=db,
        )

    leave_repo.add_approval_history(
        leave_id=req.leave_id,
        action_by=action_by_emp_id,
        action=action_clean,
        remarks=payload.remarks or payload.rejection_reason,
        db=db,
    )

    updated_req = leave_repo.get_leave_request_by_public_id(leave_public_id, db=db)
    utils.log_action("LEAVE_PROCESSED", f"public_id={leave_public_id} action={action_clean}")
    return {"ok": True, "request": updated_req.to_dict() if updated_req else req.to_dict()}


def cancel_leave_request(leave_public_id: str, action_by_emp_id: int, db: Session) -> dict:
    """Cancels a pending or approved leave request and refunds balance if previously approved."""
    req = leave_repo.get_leave_request_by_public_id(leave_public_id, db=db)
    if not req:
        return {"ok": False, "error": "not_found", "message": f"Leave request with public_id '{leave_public_id}' not found"}

    if req.status == "cancelled":
        return {"ok": False, "error": "validation", "message": "Leave request is already cancelled"}

    # Refund balance if was approved
    if req.status == "approved" and req.leave_type and req.leave_type.is_paid:
        leave_repo.deduct_leave_balance(
            emp_id=req.employee_id,
            leave_type_id=req.leave_type_id,
            year=req.start_date.year,
            days=-int(req.total_days),  # negative deduct = refund
            db=db,
        )

    leave_repo.update_leave_request_status(leave_id=req.leave_id, status_val="cancelled", db=db)
    
    # If the employee was 'on_leave', check if they have any other approved leave active today
    emp = emp_repo.get_by_id(req.employee_id, db=db)
    if emp and emp.employee_status.lower() == "on_leave":
        from models.leave import LeaveRequest
        from sqlalchemy import select, func
        today = datetime.date.today()
        other_active = db.scalar(
            select(func.count(LeaveRequest.leave_id)).where(
                LeaveRequest.employee_id == emp.emp_id,
                LeaveRequest.leave_id != req.leave_id,
                func.lower(LeaveRequest.status) == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
            )
        ) or 0
        if other_active == 0:
            emp.employee_status = "active"
            db.flush()
            invalidate_cache("employee_lists")
            if hasattr(emp, "public_id") and emp.public_id:
                invalidate_cache("employee_profiles", str(emp.public_id))

    leave_repo.add_approval_history(
        leave_id=req.leave_id,
        action_by=action_by_emp_id,
        action="cancelled",
        remarks="Cancelled by user/manager",
        db=db,
    )

    updated_req = leave_repo.get_leave_request_by_public_id(leave_public_id, db=db)
    utils.log_action("LEAVE_CANCELLED", f"public_id={leave_public_id}")
    return {"ok": True, "request": updated_req.to_dict() if updated_req else req.to_dict()}


def get_leave_requests(
    employee_public_id: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int | None = None,
    db: Session = None,  # type: ignore
) -> dict:
    emp_id = None
    if employee_public_id:
        emp = emp_repo.get_by_public_id(employee_public_id, db=db)
        if not emp:
            return {"total": 0, "skip": skip, "limit": limit, "items": []}
        emp_id = emp.emp_id

    total, items = leave_repo.get_leave_requests(
        db=db, emp_id=emp_id, status_filter=status_filter, skip=skip, limit=limit
    )
    return {"total": total, "skip": skip, "limit": limit, "items": [r.to_dict() for r in items]}


def get_leave_request_detail(public_id: str, db: Session) -> dict | None:
    req = leave_repo.get_leave_request_by_public_id(public_id, db=db)
    return req.to_dict() if req else None
