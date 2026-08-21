# src/services/designation_service.py
import utils
from sqlalchemy.orm import Session
from repository import designation_repo
from schemas.designation_schema import DesignationIn


def get_all_designations(skip: int = 0, limit: int | None = None, db: Session = None) -> dict:  # type: ignore
    total, items = designation_repo.get_paginated(db=db, skip=skip, limit=limit)
    return {"total": total, "skip": skip, "limit": limit, "items": items}


def get_designation_by_public_id(public_id: str, db: Session) -> dict | None:
    desig = designation_repo.get_by_public_id(public_id, db=db)
    return desig.to_dict() if desig else None


def create_designation(payload: DesignationIn, db: Session) -> dict:
    clean_title = payload.title.strip()
    existing = designation_repo.get_by_title(clean_title, db=db)
    if existing:
        return {"ok": False, "error": "conflict", "message": f"Designation with title '{clean_title}' already exists"}

    desig = designation_repo.create_designation(
        title=clean_title,
        grade_level=payload.grade_level,
        description=payload.description,
        db=db,
    )
    utils.log_action("DESIGNATION_CREATED", f"title={desig.title} public_id={desig.public_id}")
    return {"ok": True, "designation": desig.to_dict()}


def update_designation(public_id: str, payload: DesignationIn, db: Session) -> dict:
    desig = designation_repo.get_by_public_id(public_id, db=db)
    if not desig:
        return {"ok": False, "error": "not_found", "message": f"Designation with public_id '{public_id}' not found"}

    clean_title = payload.title.strip()
    existing = designation_repo.get_by_title(clean_title, db=db)
    if existing and existing.designation_id != desig.designation_id:
        return {"ok": False, "error": "conflict", "message": f"Designation with title '{clean_title}' already exists"}

    updated = designation_repo.update_designation(
        public_id=public_id,
        title=clean_title,
        grade_level=payload.grade_level,
        description=payload.description,
        db=db,
    )
    if not updated:
        return {"ok": False, "error": "not_found", "message": f"Designation with public_id '{public_id}' not found"}
    utils.log_action("DESIGNATION_UPDATED", f"title={updated.title} public_id={public_id}")
    return {"ok": True, "designation": updated.to_dict()}


def delete_designation(public_id: str, db: Session) -> dict:
    success, error_msg = designation_repo.delete_designation(public_id, db=db)
    if not success:
        err_type = "not_found" if "not found" in (error_msg or "").lower() else "conflict"
        return {"ok": False, "error": err_type, "message": error_msg}

    utils.log_action("DESIGNATION_DELETED", f"public_id={public_id}")
    return {"ok": True, "details": f"Designation with public_id '{public_id}' deleted"}
