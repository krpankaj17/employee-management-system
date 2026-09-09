# src/routes/employee_data_routes.py
from fastapi import HTTPException, status, APIRouter, Query, Depends
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas import (
    EmployeeIn,
    EmployeeOut,
    PaginatedEmployees,
    DirectReports,
    EmployeeProfileIn,
    EmployeeFullProfileOut,
    AdminEmployeeSetupIn,
    AddressIn,
    AddressOut,
    EmergencyContactIn,
    EmergencyContactOut,
)
from services import employee_services as emp_services
from services import address_service

router = APIRouter(prefix="/employees", tags=["Employee Management"])


@router.get("/search", response_model=PaginatedEmployees)
def search_employees(
    public_id: str | None = Query(None, description="Employee UUID"),
    email: str | None = Query(None, description="Exact employee company email"),
    employee_code: str | None = Query(None, description="Exact employee code e.g. EMP-1001"),
    reporting_manager_public_id: str | None = Query(None, description="Reporting manager UUID"),
    first_name: str | None = None,
    last_name: str | None = None,
    department_public_id: str | None = Query(None, description="Department UUID"),
    designation_public_id: str | None = Query(None, description="Designation UUID"),
    employee_status: str | None = Query(
        None, description="active, inactive, on_leave, terminated, resigned"
    ),
    employment_type: str | None = Query(
        None, description="full_time, part_time, contract, intern"
    ),
    gender: str | None = Query(None, description="male, female, other, prefer_not_to_say"),
    min_joining_date: str | None = Query(None, description="Format YYYY-MM-DD"),
    max_joining_date: str | None = Query(None, description="Format YYYY-MM-DD"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists and searches employee directory. HR/Admin with 'employee:read' can search all. Regular employees only retrieve their own record."""
    has_perm = current_user.has_exact_permission("employee:read") or current_user.has_exact_permission("role:manage")
    user_roles = [r.role_name for r in current_user.roles]
    is_admin_or_hr = "Admin" in user_roles or "HR_Manager" in user_roles

    if not has_perm and not is_admin_or_hr:
        user_emp = current_user.employee
        if not user_emp:
            return {"total": 0, "skip": 0, "limit": limit, "items": []}
        public_id = str(user_emp.public_id)

    return emp_services.search_records(
        public_id=public_id,
        email=email,
        employee_code=employee_code,
        reporting_manager_public_id=reporting_manager_public_id,
        first_name=first_name,
        last_name=last_name,
        department_public_id=department_public_id,
        designation_public_id=designation_public_id,
        employee_status=employee_status,
        employment_type=employment_type,
        gender=gender,
        min_joining_date=min_joining_date,
        max_joining_date=max_joining_date,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get("/me", response_model=EmployeeFullProfileOut, summary="Get current employee's full profile")
def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves the complete full profile (including addresses and emergency contacts) of the currently authenticated employee."""
    profile = emp_services.get_my_full_profile(current_user, db=db)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for the current user. Please complete onboarding first.",
        )
    return profile


@router.put(
    "/me",
    response_model=EmployeeFullProfileOut,
    summary="Update own employee profile",
)
def update_my_employee_profile(
    payload: EmployeeProfileIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates the authenticated employee's basic personal details, addresses, and emergency contacts."""
    result = emp_services.onboard_or_update_my_profile(current_user, payload, db=db)
    if not result["ok"]:
        code = 400 if result.get("error") == "validation" else 500
        raise HTTPException(status_code=code, detail=result["message"])
    return result["profile"]


@router.put("/{public_id}/admin-setup", response_model=EmployeeFullProfileOut, dependencies=[Depends(require_permission("employee:update"))])
def setup_employee_admin_data(
    public_id: str,
    payload: AdminEmployeeSetupIn,
    db: Session = Depends(get_db),
):
    """Configures corporate information, bank details, salary, and optional personal data for an employee in one single composite API request. Requires 'employee:update' permission."""
    result = emp_services.admin_setup_employee(public_id=public_id, payload=payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["employee"]


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:create"))])
def create_employee_route(payload: EmployeeIn, db: Session = Depends(get_db)):
    """Directly creates a new employee in the enterprise database."""
    res = emp_services.create_new_record(payload, db=db)
    if not res["ok"]:
        code = 400 if res.get("error") == "validation" else 500
        raise HTTPException(status_code=code, detail=res["message"])
    return res["record"]


@router.get("/{public_id}", response_model=EmployeeOut, summary="Get employee by public_id")
def get_employee_by_public_id_route(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves an employee by UUID. Employees can view their own profile; Admin/HR or users with employee:read can view any profile."""
    user_roles = [r.role_name for r in current_user.roles]
    is_admin_or_hr = "Admin" in user_roles or "HR_Manager" in user_roles
    has_perm = current_user.has_permission("employee:read") or current_user.has_permission("employee:view") or is_admin_or_hr

    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: As an Employee, you are only permitted to view your own personnel record.",
        )

    emp = emp_services.get_record_by_public_id(public_id, db=db)
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with public_id '{public_id}' not found",
        )
    return emp


@router.put("/{public_id}", response_model=EmployeeOut, dependencies=[Depends(require_permission("employee:update"))])
def update_employee_data(
    public_id: str, employee: EmployeeIn, db: Session = Depends(get_db)
):
    """Updates an existing employee record. Requires 'employee:update' permission."""
    result = emp_services.update_records(public_id=public_id, employee_in=employee, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("employee:delete"))])
def delete_employee_by_public_id(public_id: str, db: Session = Depends(get_db)):
    """Offboards / deletes an employee. Requires 'employee:delete' permission."""
    result = emp_services.delete_record(public_id, db=db)
    if not result["ok"]:
        code_map = {"not_found": 404, "conflict": 409, "validation": 400}
        code = code_map.get(str(result.get("error")), 500)
        raise HTTPException(
            status_code=code,
            detail=result.get("message", "Failed to delete employee"),
        )
    return {"details": result["details"]}


# ─── Address Sub-Routes ─────────────────────────────────────────────────────────

@router.get("/{public_id}/addresses", response_model=list[AddressOut])
def get_employee_addresses(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all current and permanent addresses for an employee. Requires 'employee:view' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("employee:read")
        or current_user.has_permission("role:manage")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to view addresses for other employees.",
        )

    result = address_service.get_addresses(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result["addresses"]


@router.post("/{public_id}/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def add_employee_address(
    public_id: str,
    payload: AddressIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds or updates an address for an employee. Requires 'employee:update' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("employee:update")

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to update addresses for other employees.",
        )

    result = address_service.add_address(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["address"]


@router.delete("/{public_id}/addresses/{address_public_id}")
def delete_employee_address(
    public_id: str,
    address_public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an address from an employee. Requires 'employee:update' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("employee:update")

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to delete addresses for other employees.",
        )

    result = address_service.delete_address(public_id, address_public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return {"details": result["details"]}


# ─── Emergency Contact Sub-Routes ──────────────────────────────────────────────

@router.get("/{public_id}/emergency-contacts", response_model=list[EmergencyContactOut])
def get_employee_emergency_contacts(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all emergency contacts for an employee. Requires 'employee:view' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("employee:read")
        or current_user.has_permission("role:manage")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to view emergency contacts for other employees.",
        )

    result = address_service.get_emergency_contacts(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result["contacts"]


@router.post("/{public_id}/emergency-contacts", response_model=EmergencyContactOut, status_code=status.HTTP_201_CREATED)
def add_employee_emergency_contact(
    public_id: str,
    payload: EmergencyContactIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds an emergency contact for an employee. Requires 'employee:update' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("employee:update")

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to update emergency contacts for other employees.",
        )

    result = address_service.add_emergency_contact(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["contact"]


@router.delete("/{public_id}/emergency-contacts/{contact_id}")
def delete_employee_emergency_contact(
    public_id: str,
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an emergency contact. Requires 'employee:update' permission or self-access."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("employee:update")

    if not has_perm and user_emp_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to delete emergency contacts for other employees.",
        )

    result = address_service.delete_emergency_contact(public_id, contact_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return {"details": result["details"]}