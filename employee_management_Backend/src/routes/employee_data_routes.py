# src/routes/employee_data_routes.py
from fastapi import HTTPException, status, APIRouter, Query, Depends
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission
from schemas import (
    EmployeeIn,
    EmployeeOut,
    PaginatedEmployees,
    DirectReports,
    AddressIn,
    AddressOut,
    EmergencyContactIn,
    EmergencyContactOut,
)
from services import employee_services as emp_services
from services import address_service

router = APIRouter(prefix="/employees", tags=["Employee Management"])


@router.get("", response_model=PaginatedEmployees, dependencies=[Depends(require_permission("employee:view"))])
def get_all_employees(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Lists all employees with pagination. Requires 'employee:view' permission."""
    return emp_services.get_all_records(skip=skip, limit=limit, db=db)


@router.get("/search", response_model=PaginatedEmployees, dependencies=[Depends(require_permission("employee:view"))])
def search(
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
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Searches employee directory with multi-field filtering. Requires 'employee:view' permission."""
    return emp_services.search_records(
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


@router.get("/by-email/{email}", response_model=EmployeeOut, dependencies=[Depends(require_permission("employee:view"))])
def get_employee_by_email(email: str, db: Session = Depends(get_db)):
    """Retrieves an employee by company email. Requires 'employee:view' permission."""
    employee = emp_services.get_record_by_email(email, db=db)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No employee found with email '{email}'",
        )
    return employee


@router.get("/by-code/{employee_code}", response_model=EmployeeOut, dependencies=[Depends(require_permission("employee:view"))])
def get_employee_by_code(employee_code: str, db: Session = Depends(get_db)):
    """Retrieves an employee by employee code. Requires 'employee:view' permission."""
    employee = emp_services.get_record_by_code(employee_code, db=db)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No employee found with code '{employee_code}'",
        )
    return employee


@router.get("/{public_id}/reports", response_model=DirectReports, dependencies=[Depends(require_permission("employee:view"))])
def get_employee_direct_reports(public_id: str, db: Session = Depends(get_db)):
    """Lists all direct reports under a manager. Requires 'employee:view' permission."""
    result = emp_services.get_direct_reports(public_id, db=db)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with public_id '{public_id}' not found",
        )
    return result


@router.get("/{public_id}", response_model=EmployeeOut, dependencies=[Depends(require_permission("employee:view"))])
def get_employee_by_public_id(public_id: str, db: Session = Depends(get_db)):
    """Retrieves single employee profile by public UUID. Requires 'employee:view' permission."""
    employee = emp_services.get_record_by_public_id(public_id, db=db)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with public_id '{public_id}' not found",
        )
    return employee


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:create"))])
def create_employee(employee: EmployeeIn, db: Session = Depends(get_db)):
    """Onboards a new employee record. Requires 'employee:create' permission."""
    result = emp_services.create_new_record(employee_in=employee, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


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

@router.get("/{public_id}/addresses", response_model=list[AddressOut], dependencies=[Depends(require_permission("employee:view"))])
def get_employee_addresses(public_id: str, db: Session = Depends(get_db)):
    """Lists all current and permanent addresses for an employee. Requires 'employee:view' permission."""
    result = address_service.get_addresses(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result["addresses"]


@router.post("/{public_id}/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:update"))])
def add_employee_address(public_id: str, payload: AddressIn, db: Session = Depends(get_db)):
    """Adds or updates an address for an employee. Requires 'employee:update' permission."""
    result = address_service.add_address(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["address"]


@router.delete("/{public_id}/addresses/{address_public_id}", dependencies=[Depends(require_permission("employee:update"))])
def delete_employee_address(public_id: str, address_public_id: str, db: Session = Depends(get_db)):
    """Deletes an address from an employee. Requires 'employee:update' permission."""
    result = address_service.delete_address(public_id, address_public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return {"details": result["details"]}


# ─── Emergency Contact Sub-Routes ──────────────────────────────────────────────

@router.get("/{public_id}/emergency-contacts", response_model=list[EmergencyContactOut], dependencies=[Depends(require_permission("employee:view"))])
def get_employee_emergency_contacts(public_id: str, db: Session = Depends(get_db)):
    """Lists all emergency contacts for an employee. Requires 'employee:view' permission."""
    result = address_service.get_emergency_contacts(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result["contacts"]


@router.post("/{public_id}/emergency-contacts", response_model=EmergencyContactOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:update"))])
def add_employee_emergency_contact(public_id: str, payload: EmergencyContactIn, db: Session = Depends(get_db)):
    """Adds an emergency contact for an employee. Requires 'employee:update' permission."""
    result = address_service.add_emergency_contact(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result.get("error") == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["contact"]


@router.delete("/{public_id}/emergency-contacts/{contact_id}", dependencies=[Depends(require_permission("employee:update"))])
def delete_employee_emergency_contact(public_id: str, contact_id: int, db: Session = Depends(get_db)):
    """Deletes an emergency contact. Requires 'employee:update' permission."""
    result = address_service.delete_emergency_contact(public_id, contact_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return {"details": result["details"]}