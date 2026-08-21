# src/schemas/review_schema.py
import datetime
from pydantic import BaseModel, Field


class ReviewCreateIn(BaseModel):
    employee_public_id: str = Field(description="UUID of employee being reviewed")
    reviewer_public_id: str | None = Field(default=None, description="UUID of reviewer employee")
    review_period_start: datetime.date
    review_period_end: datetime.date
    rating: float | None = Field(default=None, ge=0.0, le=5.0, description="Performance rating 0.0 to 5.0")
    comments: str | None = None
    status: str = Field(default="draft", description="draft | submitted | acknowledged | finalized")



class ReviewUpdateIn(BaseModel):
    rating: float | None = Field(default=None, ge=0.0, le=5.0)
    comments: str | None = None
    status: str | None = Field(default=None, description="draft | submitted | acknowledged | finalized")


class ReviewOut(BaseModel):
    public_id: str
    employee_public_id: str | None = None
    employee_name: str | None = None
    reviewer_public_id: str | None = None
    reviewer_name: str | None = None
    review_period_start: str
    review_period_end: str
    rating: float | None = None
    comments: str | None = None
    status: str
    created_at: str
    updated_at: str


class PaginatedReviews(BaseModel):
    total: int
    skip: int
    limit: int | None
    items: list[ReviewOut]
