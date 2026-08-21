# src/routes/document_routes.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.document_schema import DocumentMetadataIn, DocumentOut
from services import document_service

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
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Uploads a local document file for an employee. Employees can upload their own; HR requires 'document:upload'."""
    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("document:upload")

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(status_code=403, detail="You do not have permission to upload documents for this employee")

    res = await document_service.upload_document_file(
        employee_public_id=employee_public_id,
        document_type=document_type,
        file=file,
        db=db,
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
    has_perm = current_user.has_permission("document:read")

    if not has_perm and user_emp_public_id != employee_public_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view documents for this employee")

    res = document_service.get_employee_documents(employee_public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
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
    has_perm = current_user.has_permission("document:read")

    if not has_perm and doc.get("employee_public_id") != user_emp_public_id:
        raise HTTPException(status_code=403, detail="You do not have permission to view this document")

    return doc


@router.delete("/{public_id}", dependencies=[Depends(require_permission("document:delete"))])
def delete_document(public_id: str, db: Session = Depends(get_db)):
    """Deletes a document entry and cleans up storage. Requires 'document:delete' permission."""
    res = document_service.delete_document(public_id, db=db)
    if not res["ok"]:
        raise HTTPException(status_code=404, detail=res["message"])
    return {"details": res["details"]}
