# src/routes/department_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission
from schemas.department_schema import (
    DepartmentIn,
    DepartmentOut,
    PaginatedDepartments,
    DepartmentEmployees,
)
from services import department_service

router = APIRouter(prefix="/departments", tags=["Department Management"])


@router.get("", response_model=PaginatedDepartments, dependencies=[Depends(require_permission("department:read"))])
def get_all_departments(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Lists all departments with pagination and head employee public UUID. Requires 'department:read' permission."""
    return department_service.get_all_departments(skip=skip, limit=limit, db=db)


@router.get("/{public_id}", response_model=DepartmentOut, dependencies=[Depends(require_permission("department:read"))])
def get_department_by_public_id(public_id: str, db: Session = Depends(get_db)):
    """Retrieves a single department by public UUID. Requires 'department:read' permission."""
    dept = department_service.get_department_by_public_id(public_id, db=db)
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department with public_id '{public_id}' not found")
    return dept


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("department:create"))])
def create_department(payload: DepartmentIn, db: Session = Depends(get_db)):
    """Creates a new department. Requires 'department:create' permission."""
    result = department_service.create_department(payload, db=db)
    if not result["ok"]:
        code = 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["department"]


@router.put("/{public_id}", response_model=DepartmentOut, dependencies=[Depends(require_permission("department:update"))])
def update_department(
    public_id: str, payload: DepartmentIn, db: Session = Depends(get_db)
):
    """Updates an existing department. Requires 'department:update' permission."""
    result = department_service.update_department(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["department"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("department:delete"))])
def delete_department(public_id: str, db: Session = Depends(get_db)):
    """Deletes a department. Requires 'department:delete' permission."""
    result = department_service.delete_department(public_id, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 409
        raise HTTPException(status_code=code, detail=result["message"])
    return {"details": result["details"]}


@router.get("/{public_id}/employees", response_model=DepartmentEmployees, dependencies=[Depends(require_permission("department:read"))])
def get_department_employees(
    public_id: str,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Lists all employees assigned to a department. Requires 'department:read' permission."""
    result = department_service.get_department_employees(public_id, skip=skip, limit=limit, db=db)
    if not result:
        raise HTTPException(status_code=404, detail=f"Department with public_id '{public_id}' not found")
    return result