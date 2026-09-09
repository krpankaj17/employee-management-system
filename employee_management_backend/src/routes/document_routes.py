# src/routes/document_routes.py
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.document_schema import DocumentMetadataIn, DocumentOut, DocumentVerifyIn
from services import document_service

# MIME types that modern browsers can render natively (inline)
_INLINE_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "text/plain",
    "text/html",
}

router = APIRouter(prefix="/documents", tags=["Document Management"])


@router.post("/register", response_model=DocumentOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("document:upload"))])
def register_document(payload: DocumentMetadataIn, db: Session = Depends(get_db)):
    """Registers document metadata (e.g., for external S3 / Cloud storage links). Requires 'document:upload'."""
    res = document_service.register_document_metadata(payload, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["document"]


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    employee_public_id: str = Form(...),
    document_type: str = Form(...),
    document_name: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a local document file for an employee. Employees can upload their own; HR requires 'document:upload'."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("document:upload")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(status_code=403, detail="Access not granted: You do not have permission to upload documents for other employees.")

    res = await document_service.upload_document_file(
        employee_public_id=employee_public_id,
        document_type=document_type,
        file=file,
        db=db,
        document_name=document_name,
    )
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["document"]


@router.get("/employee/{employee_public_id}", response_model=list[DocumentOut])
def get_employee_documents(
    employee_public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists documents for an employee. Employee viewing own or users with 'document:read'."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("document:read")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(status_code=403, detail="Access not granted: You do not have permission to view documents for other employees.")

    res = document_service.get_employee_documents(employee_public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return res["documents"]


@router.get("/pending", response_model=list[DocumentOut])
def get_pending_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all documents pending verification.
    Requires Admin, HR_Manager, or 'document:read' / 'document:verify' permission.
    """
    user_roles = [r.role_name for r in current_user.roles]
    can_view = (
        current_user.has_permission("document:verify")
        or current_user.has_permission("document:read")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )
    if not can_view:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: You do not have permission to view pending documents queue.",
        )

    res = document_service.get_pending_documents(db=db)
    return res["documents"]


@router.get("/{public_id}", response_model=DocumentOut)
def get_document(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves document detail by public UUID."""
    doc = document_service.get_document_by_public_id(public_id, db=db)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{public_id}' not found")

    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("document:read")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )

    if not has_perm and doc.get("employee_public_id") != user_emp_public_id:
        raise HTTPException(status_code=403, detail="Access not granted: You do not have permission to view this document.")

    return doc


@router.post("/{public_id}/verify", response_model=DocumentOut)
def verify_document(
    public_id: str,
    payload: DocumentVerifyIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies or rejects an employee document.
    Admins, HR Managers, or users with 'document:verify' can verify any document (including self-owned documents).
    """
    user_roles = [r.role_name for r in current_user.roles]
    can_verify = (
        current_user.has_permission("document:verify")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )
    if not can_verify:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted: Only Admin and HR can verify documents.",
        )

    verifier_identifier = current_user.display_name or current_user.email or str(current_user.public_id)
    res = document_service.verify_document(
        public_id=public_id,
        status_value=payload.status,
        notes=payload.verification_notes,
        verified_by_user_id=verifier_identifier,
        db=db,
    )
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["document"]




# ---------------------------------------------------------------------------
# Internal helper — shared RBAC check + file resolution
# ---------------------------------------------------------------------------
def _find_file_on_disk(raw_url: str) -> Path | None:
    if not raw_url:
        return None
    p = Path(raw_url)
    if p.exists() and p.is_file():
        return p

    basename = p.name
    candidate_dirs = [
        Path("uploads/documents"),
        Path("../uploads/documents"),
        Path(__file__).resolve().parent.parent.parent / "uploads" / "documents",
        Path("c:/Datansh Project/uploads/documents"),
        Path("c:/Datansh Project/Python/uploads/documents"),
        Path("c:/Datansh Project/employee_management_backend_java/EmployeeManagment/EmployeeManagment/uploads/documents"),
    ]
    for d in candidate_dirs:
        cand = d / basename
        if cand.exists() and cand.is_file():
            return cand
    return None


def _resolve_document_file(public_id: str, current_user: User, db: Session):
    """Validates access rights and returns (file_path, mime_type, document_name)."""
    doc = document_service.get_document_by_public_id(public_id, db=db)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{public_id}' not found")

    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    user_roles = [r.role_name for r in current_user.roles]
    has_perm = (
        current_user.has_permission("document:read")
        or "Admin" in user_roles
        or "HR_Manager" in user_roles
    )
    if not has_perm and doc.get("employee_public_id") != user_emp_public_id:
        raise HTTPException(status_code=403, detail="Access not granted: You do not have permission to access this document.")

    file_path = _find_file_on_disk(doc["document_url"])
    if not file_path:
        raise HTTPException(status_code=404, detail="The document file was not found on the server. It may have been moved or deleted.")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"

    return file_path, mime_type, doc["document_name"]


@router.get("/{public_id}/view", summary="View document inline in the browser")
def view_document(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Opens the document inline in the browser (PDF / images render directly in the browser tab).
    Non-previewable formats (DOCX, XLSX) automatically fall back to download.
    Requires 'document:read' permission, or employee accessing their own document.
    """
    file_path, mime_type, doc_name = _resolve_document_file(public_id, current_user, db)

    # Non-previewable types automatically fall back to attachment
    is_previewable = mime_type in _INLINE_MIME_TYPES
    disposition = "inline" if is_previewable else "attachment"

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=doc_name,
        headers={"Content-Disposition": f'{disposition}; filename="{doc_name}"'},
    )


@router.get("/{public_id}/download", summary="Download document as a file")
def download_document(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Forces a file-save download dialog in the browser regardless of file type.
    Requires 'document:read' permission, or employee accessing their own document.
    """
    file_path, mime_type, doc_name = _resolve_document_file(public_id, current_user, db)

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=doc_name,
        headers={"Content-Disposition": f'attachment; filename="{doc_name}"'},
    )


@router.delete("/{public_id}", dependencies=[Depends(require_permission("document:delete"))])
def delete_document(public_id: str, db: Session = Depends(get_db)):
    """Deletes a document entry and cleans up storage. Requires 'document:delete' permission."""
    res = document_service.delete_document(public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return {"details": res["details"]}

