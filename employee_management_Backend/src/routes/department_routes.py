#department_routes.py

from fastapi import HTTPException, status, APIRouter, Query
from pydantic import BaseModel, Field
import services

router = APIRouter()


class DepartmentIn(BaseModel):
    name: str = Field(min_length=1)
    head_employee_id: int | None = None


class DepartmentOut(BaseModel):
    id: int
    name: str
    head_employee_id: int | None
    created_at: str
    updated_at: str


class PaginatedDepartments(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[DepartmentOut]


class DepartmentEmployeeOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    employee_status: str


class DepartmentEmployees(BaseModel):
    department_id: int
    total: int
    skip: int
    limit: int | None
    items: list[DepartmentEmployeeOut]


@router.get("/departments", response_model=PaginatedDepartments)
def get_all_departments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
):
    return services.get_all_departments(skip=skip, limit=limit)


@router.get("/department/{department_id}", response_model=DepartmentOut)
def get_department_by_id(department_id: int):
    department = services.get_department_by_id(department_id)
    if department is None:
        raise HTTPException(status_code=404, detail=f"Department with id {department_id} not found")
    return department


@router.post("/department", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(department: DepartmentIn):
    result = services.create_new_department(department.name, department.head_employee_id)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result["record"]


@router.put("/department/{department_id}", response_model=DepartmentOut)
def update_department(department_id: int, department: DepartmentIn):
    result = services.update_department(department_id, department.name, department.head_employee_id)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]


@router.delete("/department/{department_id}")
def delete_department_by_id(department_id: int):
    result = services.delete_department(department_id)
    if not result["ok"]:
        code = {"not_found": 404, "conflict": 409}.get(result["error"], 400)
        raise HTTPException(status_code=code, detail=result["message"])
    return {"details": result["details"]}


@router.get("/department/{department_id}/employees", response_model=DepartmentEmployees)
def get_department_employees(
    department_id: int,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
):
    result = services.get_department_employees(department_id, skip=skip, limit=limit)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Department with id {department_id} not found")
    return result