# src/repository/review_repo.py
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload
from models.review import PerformanceReview


def get_review_by_public_id(public_id: str, db: Session) -> PerformanceReview | None:
    """Finds a performance review by public UUID."""
    stmt = (
        select(PerformanceReview)
        .options(
            joinedload(PerformanceReview.employee),
            joinedload(PerformanceReview.reviewer),
        )
        .where(PerformanceReview.public_id == public_id)
    )
    return db.scalar(stmt)


def list_reviews(
    emp_id: int | None,
    reviewer_id: int | None,
    status: str | None,
    skip: int,
    limit: int | None,
    db: Session,
) -> tuple[list[PerformanceReview], int]:
    """Lists reviews with filtering and pagination."""
    query = select(PerformanceReview).options(
        joinedload(PerformanceReview.employee),
        joinedload(PerformanceReview.reviewer),
    )

    if emp_id:
        query = query.where(PerformanceReview.emp_id == emp_id)
    if reviewer_id:
        query = query.where(PerformanceReview.reviewer_id == reviewer_id)
    if status:
        query = query.where(PerformanceReview.status == status)

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_stmt) or 0

    query = query.order_by(PerformanceReview.created_at.desc()).offset(skip)
    if limit:
        query = query.limit(limit)

    results = list(db.scalars(query).all())
    return results, total


def create_review(review: PerformanceReview, db: Session) -> PerformanceReview:
    """Persists a new review."""
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def update_review(review: PerformanceReview, db: Session) -> PerformanceReview:
    """Updates review ratings or status."""
    db.commit()
    db.refresh(review)
    return review
