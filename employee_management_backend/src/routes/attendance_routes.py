# src/routes/attendance_routes.py
from typing import cast
from fastapi import HTTPException, status as http_status, APIRouter, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from repository import employee_repository as emp_repo
from repository import department_repo as dept_repo
from repository import auth_repo
from services import attendance_services as services

router = APIRouter(prefix="/attendance", tags=["Attendance Management"])


# --- UUID → internal ID resolution helper ---

def _resolve_employee_public_id(public_id: str, db: Session) -> int:
    """Resolves employee public_id UUID to internal emp_id.
    Raises HTTPException 404 if not found."""
    emp = emp_repo.get_by_public_id(public_id, db=db)
    if emp is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with public_id '{public_id}' not found",
        )
    return cast(int, emp.emp_id)


from schemas.attendance_schema import (
    CheckInIn,
    CheckOutIn,
    ManualAttendanceIn,
    AttendanceUpdateIn,
    AttendanceOut,
    PaginatedAttendance,
    MonthlyBreakdownItem,
    MonthlyAttendanceSummary,
    YearlyAttendanceSummary,
    AttendanceSettingsIn,
    AttendanceSettingsOut,
)


# --- Endpoints ---

@router.post("/check-in", response_model=AttendanceOut, status_code=http_status.HTTP_201_CREATED)
def check_in(
    payload: CheckInIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Records an employee live check-in with exact server-side timestamp.
    Client CANNOT pass date or time - server authority strictly enforced.
    Employees can check in for themselves, or HR/Admin with 'attendance:create' permission."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    target_emp_public_id = payload.employee_public_id or user_emp_public_id
    if not target_emp_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access not granted: No employee profile is linked to your user account.",
        )

    is_admin_or_hr = current_user.has_role("Admin") or current_user.has_role("HR_Manager")
    if not is_admin_or_hr and user_emp_public_id != target_emp_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You can only check in for your own employee profile.",
        )

    employee_id = _resolve_employee_public_id(target_emp_public_id, db)
    result = services.check_in_employee(
        employee_id=employee_id,
        work_mode=payload.work_mode,
        notes=payload.notes,
        timezone=payload.timezone,
    )
    if not result["ok"]:
        code_map = {"not_found": 404, "conflict": 409, "validation": 400}
        code = code_map.get(str(result.get("error")), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.post("/check-out", response_model=AttendanceOut)
def check_out(
    payload: CheckOutIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Records an employee live check-out with exact server-side timestamp.
    Client CANNOT pass date or time - server authority strictly enforced.
    Employees can check out for themselves, or HR/Admin with 'attendance:create' permission."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    target_emp_public_id = payload.employee_public_id or user_emp_public_id
    if not target_emp_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access not granted: No employee profile is linked to your user account.",
        )

    is_admin_or_hr = current_user.has_role("Admin") or current_user.has_role("HR_Manager")
    if not is_admin_or_hr and user_emp_public_id != target_emp_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You can only check out for your own employee profile.",
        )

    employee_id = _resolve_employee_public_id(target_emp_public_id, db)
    result = services.check_out_employee(
        employee_id=employee_id,
        notes=payload.notes,
    )
    if not result["ok"]:
        code_map = {"not_found": 404, "conflict": 409, "validation": 400}
        code = code_map.get(str(result.get("error")), 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.post("/records", response_model=AttendanceOut, status_code=http_status.HTTP_201_CREATED, dependencies=[Depends(require_permission("attendance:create"))])
def create_manual_record(payload: ManualAttendanceIn, db: Session = Depends(get_db)):
    """Administrative override endpoint for HR/Managers to backfill missed punches or record planned leaves."""
    employee_id = _resolve_employee_public_id(payload.employee_public_id, db)
    result = services.create_manual_attendance(
        employee_id=employee_id,
        date_str=payload.date,
        check_in=payload.check_in,
        check_out=payload.check_out,
        work_mode=payload.work_mode,
        status=payload.status,
        notes=payload.notes,
        timezone=payload.timezone,
    )
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.put("/records/{attendance_id}", response_model=AttendanceOut, dependencies=[Depends(require_permission("attendance:update"))])
def update_attendance(attendance_id: str, payload: AttendanceUpdateIn):
    """Administrative update of an existing attendance record (status/work_mode/timezone/notes). Requires 'attendance:update' permission."""
    result = services.update_attendance_record(
        a_id=attendance_id,
        work_mode=payload.work_mode,
        status=payload.status,
        notes=payload.notes,
        timezone=payload.timezone,
        check_in=payload.check_in,
        check_out=payload.check_out,
    )
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.delete("/records/{attendance_id}", dependencies=[Depends(require_permission("attendance:delete"))])
def delete_attendance(attendance_id: str):
    """Deletes an attendance record by ID. Requires 'attendance:delete' permission."""
    result = services.delete_attendance_record(attendance_id)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return {"details": result["details"]}


@router.get("/records", response_model=PaginatedAttendance)
def get_all_attendance(
    employee_public_id: str | None = Query(None, description="Employee UUID to filter by"),
    department_public_id: str | None = Query(None, description="Department UUID to filter by"),
    date_from: str | None = Query(None, description="Filter date from (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter date to (YYYY-MM-DD)"),
    status: str | None = Query(None, description="Filter by status (present, half_day, on_leave, absent, not_checked_in)"),
    work_mode: str | None = Query(None, description="Filter by work mode (in_office, remote, field)"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves filtered and paginated attendance records.
    Employees are restricted to their own records only.
    HR/Admin with 'attendance:view' can query company-wide."""
    has_perm = current_user.has_permission("attendance:view") or current_user.has_permission("attendance:read")
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None

    if not has_perm:
        # Restrict to self only
        if not user_emp_public_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access not granted: No employee profile is linked to your user account.",
            )
        if employee_public_id and employee_public_id != user_emp_public_id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access not granted: You do not have permission to view attendance records for other employees.",
            )
        # Force filter to own records only
        employee_public_id = user_emp_public_id
        department_public_id = None  # Prevent department-wide queries

    # Resolve optional UUID filters to internal IDs
    employee_id = None
    if employee_public_id:
        employee_id = _resolve_employee_public_id(employee_public_id, db)

    department_id = None
    if department_public_id:
        dept = dept_repo.get_by_public_id(department_public_id, db=db)
        if dept is None:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Department with public_id '{department_public_id}' not found",
            )
        department_id = dept.dept_id

    return services.get_all_attendance(
        employee_id=employee_id,
        department_id=department_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        work_mode=work_mode,
        skip=skip,
        limit=limit,
    )


@router.get("/today/overview")
def get_today_overview(current_user: User = Depends(get_current_user)):
    """Provides a company-wide attendance status breakdown for today."""
    return services.get_today_attendance_overview()


@router.get("/settings", response_model=AttendanceSettingsOut)
def get_attendance_settings(current_user: User = Depends(get_current_user)):
    """Retrieves the official shift timing and attendance policy configuration."""
    return services.get_shift_settings()


@router.patch("/settings", response_model=AttendanceSettingsOut)
@router.put("/settings", response_model=AttendanceSettingsOut)
def update_attendance_settings(
    payload: AttendanceSettingsIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates company shift timings and auto check-out policy. Restricted to Admin and HR_Manager."""
    user_roles = auth_repo.get_user_roles(cast(int, current_user.user_id), db=db)
    if not (
        "Admin" in user_roles
        or "HR_Manager" in user_roles
        or current_user.has_permission("attendance:update")
        or current_user.has_permission("attendance:manage")
    ):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only Admin or HR Manager can change shift policy timings.",
        )
    return services.update_shift_settings(payload.model_dump(exclude_unset=True))
