from fastapi import FastAPI, HTTPException, status, APIRouter
from pydantic import BaseModel, Field
import services
router = APIRouter()
class EmployeeIn(BaseModel):
    name: str = Field(min_length=3)
    age: int = Field(gt=0, le=70)
    city: str
    salary: float = Field(gt=0)

class EmployeeOut(BaseModel):
    id: int
    name: str
    age: int 
    city: str
    salary: float

@router.get("/employees", response_model=list[EmployeeOut])
def get_all_employees():
    return services.get_all_records()

@router.get("/employee/{employee_id}", response_model=EmployeeOut)
def get_employee_by_id(employee_id: int):
    employee = services.get_record_by_id(employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail=f"Employee with id {employee_id} not found")
    return employee

@router.post("/employee", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(employee: EmployeeIn):
    result = services.create_new_record(employee.name, str(employee.age), employee.city, str(employee.salary))
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result["record"]

@router.put("/employee/{employee_id}", response_model=EmployeeOut)
def update_employee_data(employee_id: int, employee: EmployeeIn):
    result = services.update_records(employee_id, employee.name, str(employee.age), employee.city, str(employee.salary))
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["record"]

@router.delete("/employee/{employee_id}")
def delete_employee_by_id(employee_id: int):
    response = services.delete_record(employee_id)
    if not response:
        raise HTTPException(status_code=404, detail=f"Employee with id {employee_id} not found")
    return response
  
@router.get("/employees/search", response_model=list[EmployeeOut])
def search(name: str | None = None, city: str | None = None,
           min_age: int | None = None, max_age: int | None = None):
    return services.search_records(name=name, city=city, min_age=min_age, max_age=max_age)