# src/repository/document_repo.py
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from models.document import EmployeeDocument


def get_document_by_public_id(public_id: str, db: Session) -> EmployeeDocument | None:
    """Finds document by public UUID."""
    stmt = (
        select(EmployeeDocument)
        .options(joinedload(EmployeeDocument.employee))
        .where(EmployeeDocument.public_id == public_id)
    )
    return db.scalar(stmt)


def list_documents_by_employee(emp_id: int, db: Session) -> list[EmployeeDocument]:
    """Lists all documents belonging to an employee."""
    stmt = (
        select(EmployeeDocument)
        .options(joinedload(EmployeeDocument.employee))
        .where(EmployeeDocument.employee_id == emp_id)
        .order_by(EmployeeDocument.uploaded_at.desc())
    )
    return list(db.scalars(stmt).all())


def create_document(doc: EmployeeDocument, db: Session) -> EmployeeDocument:
    """Persists a new document entry."""
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(doc: EmployeeDocument, db: Session) -> None:
    """Deletes a document entry."""
    db.delete(doc)
    db.commit()


def update_document_verification(
    doc: EmployeeDocument,
    status: str,
    notes: str | None,
    verified_by_user_id: str | None,
    db: Session,
) -> EmployeeDocument:
    """Updates the verification status, notes, and verifier info."""
    import datetime
    doc.status = status
    doc.verification_notes = notes
    doc.verified_by_user_id = verified_by_user_id
    doc.verified_at = datetime.datetime.now(datetime.timezone.utc)
    doc.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(doc)
    return doc


def list_pending_documents(db: Session) -> list[EmployeeDocument]:
    """Lists all documents pending verification."""
    stmt = (
        select(EmployeeDocument)
        .options(joinedload(EmployeeDocument.employee))
        .where(EmployeeDocument.status.in_(["Pending_Verification", "pending_verification", "Pending", "pending"]))
        .order_by(EmployeeDocument.uploaded_at.desc())
    )
    return list(db.scalars(stmt).all())

