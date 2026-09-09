# src/routes/project_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.project_schema import (
    ProjectCreateIn,
    ProjectUpdateIn,
    ProjectOut,
    ProjectMemberIn,
    ProjectMemberOut,
    PaginatedProjects,
)
from services import project_service

router = APIRouter(prefix="/projects", tags=["Project Management"])


@router.get("", response_model=PaginatedProjects)
def list_projects(
    project_status: str | None = Query(None, alias="status", description="planning | active | on_hold | completed | cancelled"),
    head_employee_public_id: str | None = Query(None, description="Filter by project head UUID"),
    member_employee_public_id: str | None = Query(None, description="Filter by project member UUID"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists projects with filtering and member summaries.
    HR/Admin with 'project:read' see all. Employees see only projects they are assigned to."""
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_exact_permission("project:read")
        or "Admin" in user_roles
        or "Project_Manager" in user_roles
        or "HR_Manager" in user_roles
    )
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None

    if not has_perm:
        if not user_emp_public_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access not granted: No employee profile is linked to your user account.",
            )
        # Force filter to projects where this employee is a member or head
        member_employee_public_id = user_emp_public_id

    return project_service.list_projects(
        status=project_status,
        head_public_id=head_employee_public_id,
        member_public_id=member_employee_public_id,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get("/{public_id}", response_model=ProjectOut)
def get_project(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single project with its assigned team members.
    Employees can only view projects they belong to; HR/Admin with 'project:read' can view any."""
    res = project_service.get_project_by_public_id(public_id, db=db)
    if not res:
        raise HTTPException(status_code=404, detail=f"Project with public_id '{public_id}' not found")

    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_exact_permission("project:read")
        or "Admin" in user_roles
        or "Project_Manager" in user_roles
        or "HR_Manager" in user_roles
    )
    if not has_perm:
        user_emp = current_user.employee
        user_emp_public_id = str(user_emp.public_id) if user_emp else None
        members = [m.get("employee_public_id") for m in res.get("members", [])]
        head_public_id = res.get("project_head_public_id")
        if user_emp_public_id not in members and user_emp_public_id != head_public_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access not granted: You are not assigned to this project.",
            )

    return res



@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("project:create"))])
def create_project(payload: ProjectCreateIn, db: Session = Depends(get_db)):
    """Creates a new project. Requires 'project:create' permission."""
    res = project_service.create_project(payload, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["project"]


@router.put("/{public_id}", response_model=ProjectOut, dependencies=[Depends(require_permission("project:update"))])
def update_project(public_id: str, payload: ProjectUpdateIn, db: Session = Depends(get_db)):
    """Updates an existing project. Requires 'project:update' permission."""
    res = project_service.update_project(public_id, payload, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["project"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("project:delete"))])
def delete_project(public_id: str, db: Session = Depends(get_db)):
    """Deletes a project. Requires 'project:delete' permission."""
    res = project_service.delete_project(public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return {"details": res["details"]}


@router.post("/{public_id}/members", response_model=ProjectMemberOut, dependencies=[Depends(require_permission("project:update"))])
def add_project_member(public_id: str, payload: ProjectMemberIn, db: Session = Depends(get_db)):
    """Assigns an employee to a project. Requires 'project:update' permission."""
    res = project_service.add_member(public_id, payload, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["member"]


@router.delete("/{public_id}/members/{employee_public_id}", dependencies=[Depends(require_permission("project:update"))])
def remove_project_member(public_id: str, employee_public_id: str, db: Session = Depends(get_db)):
    """Removes an employee from a project. Requires 'project:update' permission."""
    res = project_service.remove_member(public_id, employee_public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return {"details": res["details"]}
