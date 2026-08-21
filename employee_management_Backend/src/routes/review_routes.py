# src/routes/review_routes.py
from typing import cast
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission, get_current_user
from models.user import User
from schemas.review_schema import (
    ReviewCreateIn,
    ReviewUpdateIn,
    ReviewOut,
    PaginatedReviews,
)
from services import review_service

router = APIRouter(prefix="/reviews", tags=["Performance Reviews"])


@router.get("", response_model=PaginatedReviews, dependencies=[Depends(require_permission("review:read"))])
def list_reviews(
    employee_public_id: str | None = Query(None, description="Filter by employee UUID"),
    reviewer_public_id: str | None = Query(None, description="Filter by reviewer UUID"),
    status: str | None = Query(None, description="draft | submitted | acknowledged | finalized"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Lists performance reviews with filtering. Requires 'review:read' permission."""
    return review_service.list_performance_reviews(
        employee_public_id=employee_public_id,
        reviewer_public_id=reviewer_public_id,
        status=status,
        skip=skip,
        limit=limit,
        db=db,
    )


@router.get("/{public_id}", response_model=ReviewOut)
def get_review(
    public_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single review. Allowed for employee being reviewed, reviewer, or users with 'review:read'."""
    res = review_service.get_performance_review(public_id, db=db)
    if not res:
        raise HTTPException(status_code=404, detail=f"Review '{public_id}' not found")

    user_emp = current_user.employee
    user_emp_public_id = str(user_emp.public_id) if user_emp else None
    has_perm = current_user.has_permission("review:read")

    if (
        not has_perm
        and res.get("employee_public_id") != user_emp_public_id
        and res.get("reviewer_public_id") != user_emp_public_id
    ):
        raise HTTPException(status_code=403, detail="You do not have permission to view this review")

    return res


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("review:create"))])
def create_review(
    payload: ReviewCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a performance review for an employee. Requires 'review:create' permission."""
    if not current_user.employee:
        raise HTTPException(status_code=403, detail="Reviewer must have an active employee profile")

    reviewer_emp_id = cast(int, current_user.employee.emp_id)
    res = review_service.create_performance_review(payload, caller_emp_id=reviewer_emp_id, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["review"]


@router.put("/{public_id}", response_model=ReviewOut)
def update_review(
    public_id: str,
    payload: ReviewUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates review ratings/feedback. Reviewer, employee (for acknowledgement), or HR with 'review:create'."""
    res = review_service.update_performance_review(public_id, payload, db=db)
    if not res["ok"]:
        code = 404 if res["error"] == "not_found" else 400
        raise HTTPException(status_code=code, detail=res["message"])
    return res["review"]
