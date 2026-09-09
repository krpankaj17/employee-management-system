# src/repository/project_repo.py
from typing import cast
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session, joinedload
from models.project import Project, ProjectMember
from models.employee import Employee


def get_project_by_public_id(public_id: str, db: Session) -> Project | None:
    """Finds a project by public UUID with members and head employee."""
    stmt = (
        select(Project)
        .options(
            joinedload(Project.project_head),
            joinedload(Project.members).joinedload(ProjectMember.employee),
        )
        .where(Project.public_id == public_id)
    )
    return db.scalar(stmt)


def list_projects(
    status: str | None,
    head_emp_id: int | None,
    member_emp_id: int | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> tuple[list[Project], int]:
    """Lists projects with optional status, head, and member filtering with total count."""
    query = select(Project).options(
        joinedload(Project.project_head),
        joinedload(Project.members).joinedload(ProjectMember.employee),
    )

    if status:
        query = query.where(Project.status == status)
    if head_emp_id:
        query = query.where(Project.project_head_id == head_emp_id)
    if member_emp_id:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.project_id).where(
            ProjectMember.employee_id == member_emp_id
        )

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_stmt) or 0

    query = query.order_by(Project.created_at.desc()).offset(skip)
    if limit:
        query = query.limit(limit)

    results = list(db.scalars(query).unique().all())
    return results, total


def create_project(project: Project, db: Session) -> Project:
    """Persists a new project."""
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(project: Project, db: Session) -> Project:
    """Saves updates to a project."""
    db.commit()
    db.refresh(project)
    return project


def delete_project(project: Project, db: Session) -> None:
    """Deletes a project."""
    db.delete(project)
    db.commit()


def add_project_member(project_id: int, employee_id: int, role: str | None, db: Session) -> ProjectMember:
    """Adds or updates an employee's assignment in a project."""
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.employee_id == employee_id,
        )
    )
    if member:
        member.role_in_project = role
    else:
        member = ProjectMember(project_id=project_id, employee_id=employee_id, role_in_project=role)
        db.add(member)

    db.commit()
    db.refresh(member)
    return member


def remove_project_member(project_id: int, employee_id: int, db: Session) -> bool:
    """Removes an employee from a project."""
    member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.employee_id == employee_id,
        )
    )
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True

