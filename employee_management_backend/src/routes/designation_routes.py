# src/routes/designation_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.designation_schema import (
    DesignationIn,
    DesignationOut,
    PaginatedDesignations,
)
from services import designation_service

router = APIRouter(prefix="/designations", tags=["Designation Management"])


@router.get("", response_model=PaginatedDesignations, dependencies=[Depends(require_permission("employee:read"))])
def get_all_designations(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int | None = Query(None, gt=0, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Lists all designations with pagination. Requires 'employee:read' permission (HR/Admin)."""
    return designation_service.get_all_designations(skip=skip, limit=limit, db=db)


@router.get("/{public_id}", response_model=DesignationOut)
def get_designation_by_public_id(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single designation. Employees can view their own designation only; HR/Admin can view any."""
    # Resolve the requested designation first
    desig = designation_service.get_designation_by_public_id(public_id, db=db)
    if not desig:
        raise HTTPException(status_code=404, detail=f"Designation with public_id '{public_id}' not found")

    has_perm = current_user.has_permission("employee:read") or current_user.has_permission("employee:view")

    if not has_perm:
        # Check if the designation belongs to the calling employee
        user_emp = current_user.employee
        emp_desig_public_id = str(user_emp.designation.public_id) if user_emp and user_emp.designation else None
        if emp_desig_public_id != public_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access not granted: You are only permitted to view your own assigned designation.",
            )

    return desig


@router.post("", response_model=DesignationOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("employee:create"))])
def create_designation(payload: DesignationIn, db: Session = Depends(get_db)):
    """Creates a new designation. Requires 'employee:create' permission."""
    result = designation_service.create_designation(payload, db=db)
    if not result["ok"]:
        code = 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["designation"]


@router.put("/{public_id}", response_model=DesignationOut, dependencies=[Depends(require_permission("employee:update"))])
def update_designation(public_id: str, payload: DesignationIn, db: Session = Depends(get_db)):
    """Updates designation details. Requires 'employee:update' permission."""
    result = designation_service.update_designation(public_id, payload, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 409 if result["error"] == "conflict" else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result["designation"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("employee:delete"))])
def delete_designation(public_id: str, db: Session = Depends(get_db)):
    """Deletes a designation. Requires 'employee:delete' permission."""
    result = designation_service.delete_designation(public_id, db=db)
    if not result["ok"]:
        code = 404 if result["error"] == "not_found" else 409
        raise HTTPException(status_code=code, detail=result["message"])
    return {"details": result["details"]}

