# src/routes/department_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
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
    """Lists all departments with pagination and head employee public UUID. Restricted to HR and Admin ('department:read')."""
    return department_service.get_all_departments(skip=skip, limit=limit, db=db)


from sqlalchemy import select
from models.department import Department


@router.get("/me", response_model=DepartmentOut, summary="Get current employee's department")
def get_my_department(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves the department details of the currently authenticated employee."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for the current user",
        )
    dept_pid = current_user.employee.department_public_id
    if not dept_pid and current_user.employee.dept_id:
        dept_obj = db.scalar(select(Department).where(Department.dept_id == current_user.employee.dept_id))
        if dept_obj:
            dept_pid = str(dept_obj.public_id)

    if not dept_pid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No department assigned to the current user",
        )
    dept = department_service.get_department_by_public_id(dept_pid, db=db)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned department record not found",
        )
    return dept


@router.get("/me/employees", response_model=DepartmentEmployees, summary="Get employees in current employee's department")
def get_my_department_employees(
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all employees working in the currently authenticated employee's department."""
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for the current user",
        )
    dept_pid = current_user.employee.department_public_id
    if not dept_pid and current_user.employee.dept_id:
        dept_obj = db.scalar(select(Department).where(Department.dept_id == current_user.employee.dept_id))
        if dept_obj:
            dept_pid = str(dept_obj.public_id)

    if not dept_pid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No department assigned to the current user",
        )
    result = department_service.get_department_employees(
        dept_pid, skip=skip, limit=limit, db=db
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned department record not found",
        )
    return result


@router.get("/{public_id}", response_model=DepartmentOut)
def get_department_by_public_id(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single department by public UUID.
    Admin/HR can access any department. Regular employees can only access their own assigned department.
    """
    has_perm = current_user.has_permission("department:read") or current_user.has_permission("department:view")
    user_dept_public_id = current_user.employee.department_public_id if current_user.employee else None

    if not has_perm and user_dept_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You are only allowed to view your own assigned department.",
        )

    dept = department_service.get_department_by_public_id(public_id, db=db)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with public_id '{public_id}' not found",
        )
    return dept


@router.get("/{public_id}/employees", response_model=DepartmentEmployees)
def get_department_employees(
    public_id: str,
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all employees assigned to a department.
    Admin/HR can access any department. Regular employees can only access their own assigned department.
    """
    has_perm = current_user.has_permission("department:read") or current_user.has_permission("department:view")
    user_dept_public_id = current_user.employee.department_public_id if current_user.employee else None

    if not has_perm and user_dept_public_id != public_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You are only allowed to view employees in your own assigned department.",
        )

    result = department_service.get_department_employees(public_id, skip=skip, limit=limit, db=db)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with public_id '{public_id}' not found",
        )
    return result


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