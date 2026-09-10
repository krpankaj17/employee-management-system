# src/schemas/document_schema.py
from pydantic import BaseModel, Field


class DocumentMetadataIn(BaseModel):
    employee_public_id: str = Field(description="UUID of the employee")
    document_name: str = Field(min_length=2, max_length=255)
    document_type: str = Field(
        description="aadhaar | pan | passport | resume | offer_letter | experience_letter | other"
    )
    document_url: str = Field(description="URL or storage path of the document")
    file_size_bytes: int | None = Field(default=None, gt=0)


class DocumentVerifyIn(BaseModel):
    status: str = Field(description="Verified | Rejected | Pending_Verification")
    verification_notes: str | None = Field(default=None, max_length=1000)


class DocumentOut(BaseModel):
    public_id: str
    employee_public_id: str | None = None
    employee_name: str | None = None
    document_name: str
    document_type: str
    document_url: str
    file_size_bytes: int | None = None
    status: str | None = "Pending_Verification"
    verification_notes: str | None = None
    verified_by_user_id: str | None = None
    verified_at: str | None = None
    created_at: str | None = None


class PaginatedDocuments(BaseModel):
    total: int
    skip: int
    limit: int | None = None
    items: list[DocumentOut]

