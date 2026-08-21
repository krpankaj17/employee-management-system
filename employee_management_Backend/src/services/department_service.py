# src/services/department_service.py
import utils
from sqlalchemy.orm import Session
from repository import department_repo
from repository import employee_repository as emp_repo
from schemas.department_schema import DepartmentIn


def _resolve_head_employee_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves head_employee public_id UUID to internal emp_id."""
    if not public_id:
        return None, None
    emp = emp_repo.get_by_public_id(public_id, db=db)
    if not emp:
        return None, f"Head employee with public_id '{public_id}' does not exist"
    return emp.emp_id, None


def _format_department(dept, db: Session) -> dict:
    """Formats Department ORM object into dictionary with head_employee_public_id UUID."""
    head_public_id = None
    if dept.head_employee_id:
        head_emp = emp_repo.get_by_id(dept.head_employee_id, db=db)
        if head_emp and hasattr(head_emp, "public_id"):
            head_public_id = str(head_emp.public_id)

    return {
        "public_id": str(dept.public_id),
        "dept_name": dept.dept_name,
        "dept_code": dept.dept_code,
        "description": dept.description,
        "head_employee_public_id": head_public_id,
        "created_at": (
            dept.created_at.isoformat()
            if hasattr(dept.created_at, "isoformat")
            else str(dept.created_at)
        ),
        "updated_at": (
            dept.updated_at.isoformat()
            if hasattr(dept.updated_at, "isoformat")
            else str(dept.updated_at)
        ),
    }


def get_all_departments(skip: int = 0, limit: int | None = None, db: Session = None) -> dict:  # type: ignore
    total, items = department_repo.get_paginated(db=db, skip=skip, limit=limit)
    formatted = [_format_department(d, db=db) for d in items]
    return {"total": total, "skip": skip, "limit": limit, "items": formatted}


def get_department_by_public_id(public_id: str, db: Session) -> dict | None:
    dept = department_repo.get_by_public_id(public_id, db=db)
    if not dept:
        return None
    return _format_department(dept, db=db)


def create_department(payload: DepartmentIn, db: Session) -> dict:
    clean_name = payload.dept_name.strip()
    clean_code = payload.dept_code.strip().upper()

    existing_name = department_repo.get_by_name(clean_name, db=db)
    if existing_name:
        return {"ok": False, "error": "conflict", "message": f"Department with name '{clean_name}' already exists"}

    existing_code = department_repo.get_by_code(clean_code, db=db)
    if existing_code:
        return {"ok": False, "error": "conflict", "message": f"Department with code '{clean_code}' already exists"}

    head_id, err = _resolve_head_employee_uuid(payload.head_employee_public_id, db=db)
    if err:
        return {"ok": False, "error": "validation", "message": err}

    dept = department_repo.create_department(
        dept_name=clean_name,
        dept_code=clean_code,
        description=payload.description,
        head_employee_id=head_id,
        db=db,
    )
    formatted = _format_department(dept, db=db)
    utils.log_action("DEPARTMENT_CREATED", f"name={dept.dept_name} public_id={dept.public_id}")
    return {"ok": True, "department": formatted}


def update_department(public_id: str, payload: DepartmentIn, db: Session) -> dict:
    dept = department_repo.get_by_public_id(public_id, db=db)
    if not dept:
        return {"ok": False, "error": "not_found", "message": f"Department with public_id '{public_id}' not found"}

    clean_name = payload.dept_name.strip()
    clean_code = payload.dept_code.strip().upper()

    existing_name = department_repo.get_by_name(clean_name, db=db)
    if existing_name and existing_name.dept_id != dept.dept_id:
        return {"ok": False, "error": "conflict", "message": f"Department with name '{clean_name}' already exists"}

    existing_code = department_repo.get_by_code(clean_code, db=db)
    if existing_code and existing_code.dept_id != dept.dept_id:
        return {"ok": False, "error": "conflict", "message": f"Department with code '{clean_code}' already exists"}

    head_id, err = _resolve_head_employee_uuid(payload.head_employee_public_id, db=db)
    if err:
        return {"ok": False, "error": "validation", "message": err}

    updated = department_repo.update_department(
        public_id=public_id,
        dept_name=clean_name,
        dept_code=clean_code,
        description=payload.description,
        head_employee_id=head_id,
        db=db,
    )
    if not updated:
        return {"ok": False, "error": "not_found", "message": f"Department with public_id '{public_id}' not found"}
    formatted = _format_department(updated, db=db)
    utils.log_action("DEPARTMENT_UPDATED", f"name={updated.dept_name} public_id={public_id}")
    return {"ok": True, "department": formatted}


def delete_department(public_id: str, db: Session) -> dict:
    success, error_msg = department_repo.delete_department(public_id, db=db)
    if not success:
        err_type = "not_found" if "not found" in (error_msg or "").lower() else "conflict"
        return {"ok": False, "error": err_type, "message": error_msg}

    utils.log_action("DEPARTMENT_DELETED", f"public_id={public_id}")
    return {"ok": True, "details": f"Department with public_id '{public_id}' deleted"}


def get_department_employees(public_id: str, skip: int = 0, limit: int | None = None, db: Session = None) -> dict | None:  # type: ignore
    dept = department_repo.get_by_public_id(public_id, db=db)
    if not dept:
        return None

    total, items = department_repo.get_department_employees(dept.dept_id, skip=skip, limit=limit, db=db)
    return {
        "department_public_id": str(dept.public_id),
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items,
    }
