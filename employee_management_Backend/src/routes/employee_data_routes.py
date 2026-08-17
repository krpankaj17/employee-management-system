#employee_data_routes.py

from fastapi import HTTPException, status, APIRouter, Query
from pydantic import BaseModel, Field
import services

router = APIRouter(tags=["Employee Management"])


class EmployeeIn(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    dob: str = Field(description="Format YYYY-MM-DD")
    email: str
    phone: str
    address: str
    pincode: int
    department_id: int
    joining_date: str = Field(description="Format YYYY-MM-DD")
    employee_status: str
    reporting_manager_id: int | None = None


class EmployeeOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    dob: str
    email: str
    phone: str
    address: str
    pincode: int
    department_id: int
    joining_date: str
    employee_status: str
    reporting_manager_id: int | None
    created_at: str
    updated_at: str


class PaginatedEmployees(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[EmployeeOut]


class DirectReports(BaseModel):
    manager_id: int
    count: int
    reports: list[EmployeeOut]


@router.get("/employees", response_model=PaginatedEmployees)
def get_all_employees(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
):
    return services.get_all_records(skip=skip, limit=limit)


@router.get("/employees/search", response_model=PaginatedEmployees)
def search(
    first_name: str | None = None,
    last_name: str | None = None,
    department_id: int | None = None,
    employee_status: str | None = None,
    min_joining_date: str | None = Query(None, description="Format YYYY-MM-DD"),
    max_joining_date: str | None = Query(None, description="Format YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
):
    return services.search_records(
        first_name=first_name, last_name=last_name, department_id=department_id,
        employee_status=employee_status, min_joining_date=min_joining_date,
        max_joining_date=max_joining_date, skip=skip, limit=limit,
    )


@router.get("/employees/by-email/{email}", response_model=EmployeeOut)
@router.get("/employee/by-email/{email}", response_model=EmployeeOut, include_in_schema=False)
def get_employee_by_email(email: str):
    employee = services.get_record_by_email(email)
    if employee is None:
        raise HTTPException(status_code=404, detail=f"No employee found with email '{email}'")
    return employee


@router.get("/employees/{employee_id}/reports", response_model=DirectReports)
@router.get("/employee/{employee_id}/reports", response_model=DirectReports, include_in_schema=False)
def get_employee_direct_reports(employee_id: int):
    result = services.get_direct_reports(employee_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Employee with id {employee_id} not found")
    return result


@router.get("/employees/{employee_id}", response_model=EmployeeOut)
@router.get("/employee/{employee_id}", response_model=EmployeeOut, include_in_schema=False)
def get_employee_by_id(employee_id: int):
    employee = services.get_record_by_id(employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee with id {employee_id} not found")
    return employee


@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
@router.post("/employee", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_employee(employee: EmployeeIn):
    result = services.create_new_record(
        employee.first_name, employee.last_name, employee.dob, employee.email,
        employee.phone, employee.address, employee.pincode, employee.department_id,
        employee.joining_date, employee.employee_status, employee.reporting_manager_id,
    )
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.put("/employees/{employee_id}", response_model=EmployeeOut)
@router.put("/employee/{employee_id}", response_model=EmployeeOut, include_in_schema=False)
def update_employee_data(employee_id: int, employee: EmployeeIn):
    result = services.update_records(
        employee_id, employee.first_name, employee.last_name, employee.dob, employee.email,
        employee.phone, employee.address, employee.pincode, employee.department_id,
        employee.joining_date, employee.employee_status, employee.reporting_manager_id,
    )
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.delete("/employees/{employee_id}")
@router.delete("/employee/{employee_id}", include_in_schema=False)
def delete_employee_by_id(employee_id: int):
    result = services.delete_record(employee_id)
    if not result["ok"]:
        code_map = {"not_found": 404, "conflict": 409, "validation": 400}
        code = code_map.get(result.get("error"), 500)
        raise HTTPException(status_code=code, detail=result.get("message", "Failed to delete employee"))
    return {"details": result["details"]}