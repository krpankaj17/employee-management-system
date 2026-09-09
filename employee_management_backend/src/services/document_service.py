# src/services/document_service.py
import os
import uuid
from typing import Any, cast
from pathlib import Path
from fastapi import UploadFile
from sqlalchemy.orm import Session
from models.document import EmployeeDocument
from repository import document_repo as repo
from repository import employee_repository as emp_repo
from schemas.document_schema import DocumentMetadataIn
from utils.logger import log_action

UPLOAD_DIR = Path("uploads/documents")


def _ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def register_document_metadata(payload: DocumentMetadataIn, db: Session) -> dict[str, Any]:
    """Registers document metadata (e.g. for pre-stored/cloud files)."""
    emp = emp_repo.get_by_public_id(payload.employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{payload.employee_public_id}' not found"}

    valid_types = {"aadhaar", "pan", "passport", "resume", "offer_letter", "experience_letter", "other"}
    if payload.document_type.lower() not in valid_types:
        return {"ok": False, "error": "validation", "message": f"Invalid document type. Must be one of {valid_types}"}

    doc = EmployeeDocument(
        employee_id=cast(int, emp.emp_id),
        document_name=payload.document_name.strip(),
        document_type=payload.document_type.lower(),
        document_url=payload.document_url.strip(),
        file_size_bytes=payload.file_size_bytes,
    )
    saved = repo.create_document(doc, db=db)
    log_action("DOCUMENT_REGISTERED", f"Document '{saved.document_name}' registered for employee '{emp.first_name}'")
    return {"ok": True, "document": saved.to_dict()}


async def upload_document_file(
    employee_public_id: str,
    document_type: str,
    file: UploadFile,
    db: Session,
    document_name: str | None = None,
) -> dict[str, Any]:
    """Handles multipart file upload and saves document metadata."""
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{employee_public_id}' not found"}

    valid_types = {"aadhaar", "pan", "passport", "resume", "offer_letter", "experience_letter", "other"}
    if document_type.lower() not in valid_types:
        return {"ok": False, "error": "validation", "message": f"Invalid document type. Must be one of {valid_types}"}

    _ensure_upload_dir()
    file_ext = Path(file.filename or "").suffix
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename

    contents = await file.read()
    file_size = len(contents)

    with open(file_path, "wb") as f:
        f.write(contents)

    doc_name = (document_name or file.filename or "Uploaded Document").strip()

    doc = EmployeeDocument(
        employee_id=cast(int, emp.emp_id),
        document_name=doc_name,
        document_type=document_type.lower(),
        document_url=str(file_path.as_posix()),
        file_size_bytes=file_size,
    )
    saved = repo.create_document(doc, db=db)
    log_action("DOCUMENT_UPLOADED", f"File '{saved.document_name}' uploaded for employee '{emp.first_name}'")
    return {"ok": True, "document": saved.to_dict()}


def get_employee_documents(employee_public_id: str, db: Session) -> dict[str, Any]:
    """Lists all documents for an employee."""
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{employee_public_id}' not found"}

    docs = repo.list_documents_by_employee(cast(int, emp.emp_id), db=db)
    return {"ok": True, "documents": [d.to_dict() for d in docs]}


def get_document_by_public_id(public_id: str, db: Session) -> dict[str, Any] | None:
    """Retrieves document by public UUID."""
    doc = repo.get_document_by_public_id(public_id, db=db)
    return doc.to_dict() if doc else None


def delete_document(public_id: str, db: Session) -> dict[str, Any]:
    """Deletes a document entry and removes file from disk if local."""
    doc = repo.get_document_by_public_id(public_id, db=db)
    if not doc:
        return {"ok": False, "error": "not_found", "message": f"Document '{public_id}' not found"}

    if os.path.exists(doc.document_url):
        try:
            os.remove(doc.document_url)
        except OSError:
            pass

    repo.delete_document(doc, db=db)
    log_action("DOCUMENT_DELETED", f"Document '{doc.document_name}' deleted")
    return {"ok": True, "details": f"Document '{public_id}' deleted successfully"}


def verify_document(
    public_id: str,
    status_value: str,
    notes: str | None,
    verified_by_user_id: str | None,
    db: Session,
) -> dict[str, Any]:
    """Updates verification status of a document."""
    doc = repo.get_document_by_public_id(public_id, db=db)
    if not doc:
        return {"ok": False, "error": "not_found", "message": f"Document '{public_id}' not found"}

    valid_map = {
        "verified": "Verified",
        "rejected": "Rejected",
        "pending_verification": "Pending_Verification",
        "pending": "Pending_Verification",
    }
    key = status_value.strip().lower()
    if key not in valid_map:
        return {
            "ok": False,
            "error": "validation",
            "message": f"Invalid status '{status_value}'. Must be 'Verified', 'Rejected', or 'Pending_Verification'",
        }

    target_status = valid_map[key]
    updated = repo.update_document_verification(
        doc=doc,
        status=target_status,
        notes=notes.strip() if notes else None,
        verified_by_user_id=verified_by_user_id,
        db=db,
    )
    log_action("DOCUMENT_VERIFIED", f"Document '{doc.document_name}' status set to '{target_status}' by {verified_by_user_id}")
    return {"ok": True, "document": updated.to_dict()}


def get_pending_documents(db: Session) -> dict[str, Any]:
    """Retrieves all pending documents across the organization."""
    docs = repo.list_pending_documents(db=db)
    return {"ok": True, "documents": [d.to_dict() for d in docs]}

