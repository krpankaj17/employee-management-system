# src/services/project_service.py
from typing import Any, cast
from sqlalchemy.orm import Session
from models.project import Project
from repository import project_repo as repo
from repository import employee_repository as emp_repo
from schemas.project_schema import ProjectCreateIn, ProjectUpdateIn, ProjectMemberIn
from utils.logger import log_action


def create_project(payload: ProjectCreateIn, db: Session) -> dict[str, Any]:
    """Creates a new project record."""
    if payload.end_date and payload.start_date and payload.end_date < payload.start_date:
        return {"ok": False, "error": "validation", "message": "End date cannot be earlier than start date"}

    head_emp_id = None
    if payload.project_head_public_id:
        head = emp_repo.get_by_public_id(payload.project_head_public_id, db=db)
        if not head:
            return {"ok": False, "error": "not_found", "message": f"Project head employee '{payload.project_head_public_id}' not found"}
        head_emp_id = cast(int, head.emp_id)

    project = Project(
        project_name=payload.project_name.strip(),
        description=payload.description.strip() if payload.description else None,
        project_head_id=head_emp_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
    )
    saved = repo.create_project(project, db=db)
    log_action("PROJECT_CREATED", f"Project '{saved.project_name}' created (Public ID: {saved.public_id})")
    return {"ok": True, "project": saved.to_dict()}


def get_project_by_public_id(public_id: str, db: Session) -> dict[str, Any] | None:
    """Retrieves project details including assigned team members."""
    p = repo.get_project_by_public_id(public_id, db=db)
    if not p:
        return None
    data = p.to_dict()
    data["members"] = [m.to_dict() for m in p.members] if p.members else []
    return data


def list_projects(
    status: str | None,
    head_public_id: str | None,
    member_public_id: str | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> dict[str, Any]:
    """Lists projects with filtering and member summaries."""
    head_emp_id = None
    if head_public_id:
        head = emp_repo.get_by_public_id(head_public_id, db=db)
        if head:
            head_emp_id = cast(int, head.emp_id)

    member_emp_id = None
    if member_public_id:
        member = emp_repo.get_by_public_id(member_public_id, db=db)
        if member:
            member_emp_id = cast(int, member.emp_id)

    projects, total = repo.list_projects(
        status=status,
        head_emp_id=head_emp_id,
        member_emp_id=member_emp_id,
        skip=skip,
        limit=limit,
        db=db,
    )
    items = []
    for p in projects:
        d = p.to_dict()
        d["members"] = [m.to_dict() for m in p.members] if p.members else []
        items.append(d)

    return {"total": total, "skip": skip, "limit": limit, "items": items}


def update_project(public_id: str, payload: ProjectUpdateIn, db: Session) -> dict[str, Any]:
    """Updates an existing project."""
    p = repo.get_project_by_public_id(public_id, db=db)
    if not p:
        return {"ok": False, "error": "not_found", "message": f"Project '{public_id}' not found"}

    if payload.project_name is not None:
        p.project_name = payload.project_name.strip()
    if payload.description is not None:
        p.description = payload.description.strip()
    if payload.status is not None:
        p.status = payload.status
    if payload.start_date is not None:
        p.start_date = payload.start_date
    if payload.end_date is not None:
        p.end_date = payload.end_date

    if p.end_date and p.start_date and p.end_date < p.start_date:
        return {"ok": False, "error": "validation", "message": "End date cannot be earlier than start date"}

    if payload.project_head_public_id is not None:
        if payload.project_head_public_id == "":
            p.project_head_id = None
        else:
            head = emp_repo.get_by_public_id(payload.project_head_public_id, db=db)
            if not head:
                return {"ok": False, "error": "not_found", "message": f"Project head '{payload.project_head_public_id}' not found"}
            p.project_head_id = cast(int, head.emp_id)

    updated = repo.update_project(p, db=db)
    log_action("PROJECT_UPDATED", f"Project '{updated.project_name}' updated")
    return {"ok": True, "project": updated.to_dict()}


def delete_project(public_id: str, db: Session) -> dict[str, Any]:
    """Deletes a project."""
    p = repo.get_project_by_public_id(public_id, db=db)
    if not p:
        return {"ok": False, "error": "not_found", "message": f"Project '{public_id}' not found"}

    repo.delete_project(p, db=db)
    log_action("PROJECT_DELETED", f"Project '{p.project_name}' deleted")
    return {"ok": True, "details": f"Project '{public_id}' deleted successfully"}


def add_member(project_public_id: str, payload: ProjectMemberIn, db: Session) -> dict[str, Any]:
    """Adds or updates an employee assignment in a project."""
    p = repo.get_project_by_public_id(project_public_id, db=db)
    if not p:
        return {"ok": False, "error": "not_found", "message": f"Project '{project_public_id}' not found"}

    emp = emp_repo.get_by_public_id(payload.employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{payload.employee_public_id}' not found"}

    member = repo.add_project_member(
        project_id=cast(int, p.project_id),
        employee_id=cast(int, emp.emp_id),
        role=payload.role_in_project,
        db=db,
    )
    log_action("PROJECT_MEMBER_ADDED", f"Employee '{emp.first_name}' added to project '{p.project_name}' as '{payload.role_in_project}'")
    return {"ok": True, "member": member.to_dict()}


def remove_member(project_public_id: str, employee_public_id: str, db: Session) -> dict[str, Any]:
    """Removes an employee from a project."""
    p = repo.get_project_by_public_id(project_public_id, db=db)
    if not p:
        return {"ok": False, "error": "not_found", "message": f"Project '{project_public_id}' not found"}

    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{employee_public_id}' not found"}

    success = repo.remove_project_member(
        project_id=cast(int, p.project_id),
        employee_id=cast(int, emp.emp_id),
        db=db,
    )
    if not success:
        return {"ok": False, "error": "not_found", "message": "Employee is not assigned to this project"}

    log_action("PROJECT_MEMBER_REMOVED", f"Employee '{emp.first_name}' removed from project '{p.project_name}'")
    return {"ok": True, "details": "Member removed from project successfully"}
