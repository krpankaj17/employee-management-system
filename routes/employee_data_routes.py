from fastapi import FastAPI, HTTPException, status
import utils
from pydantic import BaseModel, Field


app = FastAPI()


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


@app.get("/employees", response_model=list[EmployeeOut])
def get_all_employees():
    """
    Retrieve all employee records.

    Returns:
        list[EmployeeOut]: A list containing all employees.
    """
    return utils.get_all_records()


@app.get("/employee/{employee_id}", response_model=EmployeeOut)
def get_employee_by_id(employee_id: int):
    """
    Retrieve an employee by their ID.

    Args:
        employee_id (int): The unique ID of the employee.

    Returns:
        EmployeeOut: The employee record matching the given ID.

    Raises:
        HTTPException: If the employee does not exist.
    """
    employee = utils.get_record_by_id(employee_id)

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail=f"Employee with id {employee_id} not found"
        )

    return employee


@app.post(
    "/employee",
    response_model=EmployeeOut,
    status_code=status.HTTP_201_CREATED
)
def create_employee(employee: EmployeeIn):
    """
    Create a new employee record.

    Args:
        employee (EmployeeIn): Employee information provided by the client.

    Returns:
        EmployeeOut: The newly created employee record.

    Raises:
        HTTPException: If the employee record cannot be created.
    """
    result = utils.create_new_record(
        employee.name,
        str(employee.age),
        employee.city,
        str(employee.salary)
    )

    if not result["ok"]:
        raise HTTPException(
            status_code=400,
            detail=result["message"]
        )

    return result["record"]


@app.put("/employee/{employee_id}", response_model=EmployeeOut)
def update_employee_data(employee_id: int, employee: EmployeeIn):
    """
    Update an existing employee record.

    Args:
        employee_id (int): The unique ID of the employee to update.
        employee (EmployeeIn): Updated employee information.

    Returns:
        EmployeeOut: The updated employee record.

    Raises:
        HTTPException: If the employee does not exist or the update fails.
    """
    result = utils.update_records(
        employee_id,
        employee.name,
        str(employee.age),
        employee.city,
        str(employee.salary)
    )

    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 400
        raise HTTPException(
            status_code=code,
            detail=result["message"]
        )

    return result["record"]


@app.delete("/employee/{employee_id}")
def delete_employee_by_id(employee_id: int):
    """
    Delete an employee record by ID.

    Args:
        employee_id (int): The unique ID of the employee to delete.

    Returns:
        dict: A response indicating whether the employee was deleted.

    Raises:
        HTTPException: If the employee does not exist.
    """
    response = utils.delete_record(employee_id)

    if not response:
        raise HTTPException(
            status_code=404,
            detail=f"Employee with id {employee_id} not found"
        )

    return response


@app.get("/employees/search", response_model=list[EmployeeOut])
def search(
    name: str | None = None,
    city: str | None = None,
    min_age: int | None = None,
    max_age: int | None = None
):
    """
    Search employees using optional filters.

    Args:
        name (str | None): Employee name to search for.
        city (str | None): City to filter employees by.
        min_age (int | None): Minimum employee age.
        max_age (int | None): Maximum employee age.

    Returns:
        list[EmployeeOut]: A list of employees matching the filters.
    """
    return utils.search_records(
        name=name,
        city=city,
        min_age=min_age,
        max_age=max_age
    )