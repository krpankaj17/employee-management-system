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


# --- Schemas ---

class CheckInIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the active employee checking in")
    work_mode: str = Field(default="in_office", description="in_office | remote | field")
    notes: str | None = Field(default=None, description="Optional note for the shift")


class CheckOutIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the employee checking out")
    notes: str | None = Field(default=None, description="Optional checkout / handover note")


class ManualAttendanceIn(BaseModel):
    employee_public_id: str = Field(description="UUID (public_id) of the employee")
    date: str = Field(description="Format YYYY-MM-DD (past dates, or future dates if on_leave)")
    check_in: str | None = Field(default=None, description="Format HH:MM:SS or HH:MM")
    check_out: str | None = Field(default=None, description="Format HH:MM:SS or HH:MM")
    work_mode: str = Field(default="in_office", description="in_office | remote | field")
    status: str = Field(default="present", description="present | half_day | absent | on_leave")
    notes: str | None = None


class AttendanceUpdateIn(BaseModel):
    check_in: str | None = None
    check_out: str | None = None
    work_mode: str | None = None
    status: str | None = None
    notes: str | None = None


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: str
    check_in: str | None
    check_out: str | None
    work_mode: str
    status: str
    total_hours: float
    is_late: bool = False
    late_minutes: int = 0
    notes: str | None
    created_at: str
    updated_at: str


class PaginatedAttendance(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[AttendanceOut]


class MonthlyBreakdownItem(BaseModel):
    month: int
    month_name: str
    days_present: int
    days_half_day: int
    days_on_leave: int
    days_absent: int
    total_hours_worked: float
    avg_daily_hours: float


class MonthlyAttendanceSummary(BaseModel):
    employee_id: int
    employee_name: str
    year: int
    month: int
    month_name: str
    days_in_month: int
    total_days_logged: int
    days_present: int
    days_half_day: int
    days_on_leave: int
    days_absent: int
    total_hours_worked: float
    avg_daily_hours: float
    records: list[AttendanceOut]


class YearlyAttendanceSummary(BaseModel):
    employee_id: int
    employee_name: str
    year: int
    total_days_present: int
    total_days_half_day: int
    total_days_on_leave: int
    total_days_absent: int
    total_annual_hours: float
    avg_monthly_hours: float
    monthly_breakdown: list[MonthlyBreakdownItem]


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
    is_admin_or_hr = current_user.has_role("Admin") or current_user.has_role("HR_Manager")

    if not is_admin_or_hr and user_emp_public_id != payload.employee_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You can only check in for your own employee profile",
        )

    employee_id = _resolve_employee_public_id(payload.employee_public_id, db)
    result = services.check_in_employee(
        employee_id=employee_id,
        work_mode=payload.work_mode,
        notes=payload.notes,
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
    is_admin_or_hr = current_user.has_role("Admin") or current_user.has_role("HR_Manager")

    if not is_admin_or_hr and user_emp_public_id != payload.employee_public_id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="You can only check out for your own employee profile",
        )


    employee_id = _resolve_employee_public_id(payload.employee_public_id, db)
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
@router.post("/record", response_model=AttendanceOut, status_code=http_status.HTTP_201_CREATED, include_in_schema=False, dependencies=[Depends(require_permission("attendance:create"))])
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
    )
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.put("/records/{attendance_id}", response_model=AttendanceOut, dependencies=[Depends(require_permission("attendance:update"))])
@router.put("/{attendance_id}", response_model=AttendanceOut, include_in_schema=False, dependencies=[Depends(require_permission("attendance:update"))])
def update_attendance(attendance_id: int, payload: AttendanceUpdateIn):
    """Administrative update of an existing attendance record. Requires 'attendance:update' permission."""
    result = services.update_attendance_record(
        a_id=attendance_id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        work_mode=payload.work_mode,
        status=payload.status,
        notes=payload.notes,
    )
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.delete("/records/{attendance_id}", dependencies=[Depends(require_permission("attendance:delete"))])
@router.delete("/{attendance_id}", include_in_schema=False, dependencies=[Depends(require_permission("attendance:delete"))])
def delete_attendance(attendance_id: int):
    """Deletes an attendance record by ID. Requires 'attendance:delete' permission."""
    result = services.delete_attendance_record(attendance_id)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return {"details": result["details"]}


@router.get("/today/overview", dependencies=[Depends(require_permission("attendance:view"))])
def get_today_overview():
    """Returns a real-time company snapshot for today. Requires 'attendance:view' permission."""
    return services.get_today_attendance_overview()


@router.get("/employees/{public_id}/monthly-summary", response_model=MonthlyAttendanceSummary, dependencies=[Depends(require_permission("attendance:view"))])
def get_monthly_summary(
    public_id: str,
    year: int = Query(..., ge=2000, le=2100, description="Year (e.g. 2026)"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    db: Session = Depends(get_db),
):
    """Returns monthly attendance aggregates and day-by-day shift breakdown for an employee."""
    employee_id = _resolve_employee_public_id(public_id, db)
    result = services.get_employee_monthly_attendance_summary(employee_id, year, month)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee with public_id '{public_id}' not found")
    return result


@router.get("/employees/{public_id}/yearly-summary", response_model=YearlyAttendanceSummary, dependencies=[Depends(require_permission("attendance:view"))])
def get_yearly_summary(
    public_id: str,
    year: int = Query(..., ge=2000, le=2100, description="Year (e.g. 2026)"),
    db: Session = Depends(get_db),
):
    """Returns yearly attendance totals and month-by-month trend breakdown for an employee."""
    employee_id = _resolve_employee_public_id(public_id, db)
    result = services.get_employee_yearly_attendance_summary(employee_id, year)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee with public_id '{public_id}' not found")
    return result


@router.get("/employees/{public_id}", response_model=PaginatedAttendance, dependencies=[Depends(require_permission("attendance:view"))])
def get_employee_attendance(
    public_id: str,
    date_from: str | None = Query(None, description="Filter date from (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter date to (YYYY-MM-DD)"),
    status: str | None = Query(None, description="Filter by status (present, half_day, on_leave, absent)"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Retrieves paginated attendance history for a single employee."""
    employee_id = _resolve_employee_public_id(public_id, db)
    result = services.get_employee_attendance(
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        skip=skip,
        limit=limit,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee with public_id '{public_id}' not found")
    return result


@router.get("/records", response_model=PaginatedAttendance, dependencies=[Depends(require_permission("attendance:view"))])
@router.get("", response_model=PaginatedAttendance, include_in_schema=False, dependencies=[Depends(require_permission("attendance:view"))])
def get_all_attendance(
    employee_public_id: str | None = Query(None, description="Employee UUID to filter by"),
    department_public_id: str | None = Query(None, description="Department UUID to filter by"),
    date_from: str | None = Query(None, description="Filter date from (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter date to (YYYY-MM-DD)"),
    status: str | None = Query(None, description="Filter by status (present, half_day, on_leave, absent)"),
    work_mode: str | None = Query(None, description="Filter by work mode (in_office, remote, field)"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Retrieves filtered and paginated attendance records across the entire company."""
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


@router.get("/records/{attendance_id}", response_model=AttendanceOut, dependencies=[Depends(require_permission("attendance:view"))])
@router.get("/{attendance_id}", response_model=AttendanceOut, include_in_schema=False, dependencies=[Depends(require_permission("attendance:view"))])
def get_attendance_by_id(attendance_id: int):
    """Retrieves a single attendance record by ID."""
    record = services.get_attendance_by_id(attendance_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Attendance record with id {attendance_id} not found")
    return record
