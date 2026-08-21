# src/routes/project_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission
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


@router.get("", response_model=PaginatedProjects, dependencies=[Depends(require_permission("project:read"))])
def list_projects(
    status: str | None = Query(None, description="planning | active | on_hold | completed | cancelled"),
    head_employee_public_id: str | None = Query(None, description="Filter by project head UUID"),
    member_employee_public_id: str | None = Query(None, description="Filter by project member UUID"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Lists projects with filtering and member summaries. Requires 'project:read' permission."""
    return project_service.list_projects(
        status=status,
        head_public_id=head_employee_public_id,
        member_public_id=member_employee_public_id,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get("/{public_id}", response_model=ProjectOut, dependencies=[Depends(require_permission("project:read"))])
def get_project(public_id: str, db: Session = Depends(get_db)):
    """Retrieves a single project with its assigned team members. Requires 'project:read' permission."""
    res = project_service.get_project_by_public_id(public_id, db=db)
    if not res:
        raise HTTPException(status_code=404, detail=f"Project with public_id '{public_id}' not found")
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
