# src/services/review_service.py
from decimal import Decimal
from typing import Any, cast
from sqlalchemy.orm import Session
from models.review import PerformanceReview
from repository import review_repo as repo
from repository import employee_repository as emp_repo
from schemas.review_schema import ReviewCreateIn, ReviewUpdateIn
from utils.logger import log_action


def create_performance_review(
    payload: ReviewCreateIn, caller_emp_id: int, db: Session
) -> dict[str, Any]:
    """Creates a new performance review record."""
    target_emp = emp_repo.get_by_public_id(payload.employee_public_id, db=db)
    if not target_emp:
        return {"ok": False, "error": "not_found", "message": f"Employee '{payload.employee_public_id}' not found"}

    target_emp_id = cast(int, target_emp.emp_id)

    if payload.reviewer_public_id:
        reviewer_emp = emp_repo.get_by_public_id(payload.reviewer_public_id, db=db)
        if not reviewer_emp:
            return {"ok": False, "error": "not_found", "message": f"Reviewer '{payload.reviewer_public_id}' not found"}
        actual_reviewer_emp_id = cast(int, reviewer_emp.emp_id)
    else:
        actual_reviewer_emp_id = caller_emp_id

    if target_emp_id == actual_reviewer_emp_id:
        return {"ok": False, "error": "validation", "message": "Self-reviews are not permitted. A manager must conduct the review."}

    if payload.review_period_end < payload.review_period_start:
        return {"ok": False, "error": "validation", "message": "Review period end date cannot be earlier than start date"}

    review = PerformanceReview(
        emp_id=target_emp_id,
        reviewer_id=actual_reviewer_emp_id,
        review_period_start=payload.review_period_start,
        review_period_end=payload.review_period_end,
        rating=Decimal(str(payload.rating)) if payload.rating is not None else None,
        comments=payload.comments.strip() if payload.comments else None,
        status=payload.status,
    )
    saved = repo.create_review(review, db=db)
    log_action("REVIEW_CREATED", f"Performance review created for employee ID {target_emp_id} by reviewer ID {actual_reviewer_emp_id}")
    return {"ok": True, "review": saved.to_dict()}



def get_performance_review(public_id: str, db: Session) -> dict[str, Any] | None:
    """Retrieves a single review by public UUID."""
    r = repo.get_review_by_public_id(public_id, db=db)
    return r.to_dict() if r else None


def list_performance_reviews(
    employee_public_id: str | None,
    reviewer_public_id: str | None,
    status: str | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> dict[str, Any]:
    """Lists reviews with filters."""
    emp_id = None
    if employee_public_id:
        emp = emp_repo.get_by_public_id(employee_public_id, db=db)
        if emp:
            emp_id = cast(int, emp.emp_id)

    reviewer_id = None
    if reviewer_public_id:
        rev = emp_repo.get_by_public_id(reviewer_public_id, db=db)
        if rev:
            reviewer_id = cast(int, rev.emp_id)

    reviews, total = repo.list_reviews(
        emp_id=emp_id,
        reviewer_id=reviewer_id,
        status=status,
        skip=skip,
        limit=limit,
        db=db,
    )
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": [r.to_dict() for r in reviews],
    }


def update_performance_review(
    public_id: str, payload: ReviewUpdateIn, db: Session
) -> dict[str, Any]:
    """Updates review ratings, comments, or status."""
    r = repo.get_review_by_public_id(public_id, db=db)
    if not r:
        return {"ok": False, "error": "not_found", "message": f"Review '{public_id}' not found"}

    if payload.rating is not None:
        r.rating = Decimal(str(payload.rating))
    if payload.comments is not None:
        r.comments = payload.comments.strip()
    if payload.status is not None:
        r.status = payload.status

    updated = repo.update_review(r, db=db)
    log_action("REVIEW_UPDATED", f"Performance review '{public_id}' updated (Status: {updated.status})")
    return {"ok": True, "review": updated.to_dict()}
