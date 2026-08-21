# src/repository/leave_repo.py
import datetime
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session, joinedload
from models.leave import LeaveType, LeaveRequest, LeaveApprovalHistory, EmployeeLeaveBalance
from models.employee import Employee


def get_all_leave_types(db: Session) -> list[LeaveType]:
    """Lists all configured leave types."""
    stmt = select(LeaveType).order_by(LeaveType.leave_type_id)
    return list(db.scalars(stmt).all())


def get_leave_type_by_public_id(public_id: str, db: Session) -> LeaveType | None:
    """Finds leave type by public UUID."""
    if not public_id:
        return None
    return db.scalar(select(LeaveType).where(LeaveType.public_id == public_id))


def get_leave_type_by_name(name: str, db: Session) -> LeaveType | None:
    """Finds leave type by name."""
    if not name:
        return None
    return db.scalar(select(LeaveType).where(func.lower(LeaveType.name) == name.strip().lower()))


def create_leave_type(
    name: str,
    db: Session,
    description: str | None = None,
    max_days_per_year: int = 0,
    is_paid: bool = True,
) -> LeaveType:
    """Creates a new leave type."""
    lt = LeaveType(
        name=name.strip(),
        description=description.strip() if description else None,
        max_days_per_year=max_days_per_year,
        is_paid=is_paid,
    )
    db.add(lt)
    db.commit()
    db.refresh(lt)
    return lt


def get_employee_leave_balances(
    emp_id: int, year: int, db: Session
) -> list[EmployeeLeaveBalance]:
    """Fetches all leave balances for an employee in a given year."""
    stmt = (
        select(EmployeeLeaveBalance)
        .options(
            joinedload(EmployeeLeaveBalance.employee),
            joinedload(EmployeeLeaveBalance.leave_type),
        )
        .where(
            EmployeeLeaveBalance.employee_id == emp_id,
            EmployeeLeaveBalance.year == year,
        )
        .order_by(EmployeeLeaveBalance.leave_type_id)
    )
    return list(db.scalars(stmt).all())


def get_employee_leave_balance(
    emp_id: int, leave_type_id: int, year: int, db: Session
) -> EmployeeLeaveBalance | None:
    """Fetches leave balance for an employee for a specific leave type and year."""
    stmt = (
        select(EmployeeLeaveBalance)
        .options(
            joinedload(EmployeeLeaveBalance.employee),
            joinedload(EmployeeLeaveBalance.leave_type),
        )
        .where(
            EmployeeLeaveBalance.employee_id == emp_id,
            EmployeeLeaveBalance.leave_type_id == leave_type_id,
            EmployeeLeaveBalance.year == year,
        )
    )
    return db.scalar(stmt)


def allocate_leave_balance(
    emp_id: int,
    leave_type_id: int,
    year: int,
    total_allocated: int,
    db: Session,
) -> EmployeeLeaveBalance:
    """Allocates or updates annual leave quota for an employee."""
    balance = get_employee_leave_balance(emp_id, leave_type_id, year, db=db)
    if balance:
        balance.total_allocated = total_allocated
        db.commit()
        db.refresh(balance)
        return balance

    balance = EmployeeLeaveBalance(
        employee_id=emp_id,
        leave_type_id=leave_type_id,
        year=year,
        total_allocated=total_allocated,
        used_leaves=0,
    )
    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


def deduct_leave_balance(
    emp_id: int, leave_type_id: int, year: int, days: int, db: Session
) -> None:
    """Increments used_leaves on the employee's balance."""
    balance = get_employee_leave_balance(emp_id, leave_type_id, year, db=db)
    if balance:
        balance.used_leaves += days
        db.commit()


def create_leave_request(
    emp_id: int,
    leave_type_id: int,
    start_date: datetime.date,
    end_date: datetime.date,
    total_days: float,
    db: Session,
    reason: str | None = None,
) -> LeaveRequest:
    """Creates a pending leave request and logs initial submission in history."""
    req = LeaveRequest(
        employee_id=emp_id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        reason=reason.strip() if reason else None,
        status="pending",
    )
    db.add(req)
    db.flush()

    # Log initial submission in history
    history = LeaveApprovalHistory(
        leave_id=req.leave_id,
        action_by=emp_id,
        action="submitted",
        remarks="Leave request submitted",
    )
    db.add(history)
    db.commit()

    return get_leave_request_by_public_id(str(req.public_id), db=db)  # type: ignore


def get_leave_request_by_public_id(public_id: str, db: Session) -> LeaveRequest | None:
    """Fetches a leave request by UUID with employee, approver, and full history trail."""
    if not public_id:
        return None
    stmt = (
        select(LeaveRequest)
        .options(
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.approver),
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.history).joinedload(LeaveApprovalHistory.actor),
        )
        .where(LeaveRequest.public_id == public_id)
    )
    return db.scalar(stmt)


def get_leave_requests(
    db: Session,
    emp_id: int | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[int, list[LeaveRequest]]:
    """Lists leave requests with filters and pagination."""
    conditions = []
    if emp_id is not None:
        conditions.append(LeaveRequest.employee_id == emp_id)
    if status_filter and status_filter.strip():
        conditions.append(func.lower(LeaveRequest.status) == status_filter.strip().lower())

    count_stmt = select(func.count()).select_from(LeaveRequest)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(LeaveRequest)
        .options(
            joinedload(LeaveRequest.employee),
            joinedload(LeaveRequest.approver),
            joinedload(LeaveRequest.leave_type),
            joinedload(LeaveRequest.history).joinedload(LeaveApprovalHistory.actor),
        )
        .order_by(LeaveRequest.created_at.desc())
        .offset(skip)
    )
    if conditions:
        stmt = stmt.where(*conditions)
    if limit is not None:
        stmt = stmt.limit(limit)

    items = list(db.scalars(stmt).unique().all())
    return total, items


def add_approval_history(
    leave_id: int,
    action_by: int,
    action: str,
    db: Session,
    remarks: str | None = None,
) -> LeaveApprovalHistory:
    """Appends an entry to leave_approval_history."""
    history = LeaveApprovalHistory(
        leave_id=leave_id,
        action_by=action_by,
        action=action,
        remarks=remarks,
    )
    db.add(history)
    db.commit()
    return history


def update_leave_request_status(
    leave_id: int,
    status_val: str,
    db: Session,
    approved_by: int | None = None,
    rejection_reason: str | None = None,
) -> LeaveRequest | None:
    """Updates status and approver on leave request."""
    stmt = select(LeaveRequest).where(LeaveRequest.leave_id == leave_id)
    req = db.scalar(stmt)
    if req:
        req.status = status_val
        if approved_by is not None:
            req.approved_by = approved_by
        if rejection_reason is not None:
            req.rejection_reason = rejection_reason
        db.commit()
    return req
