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
