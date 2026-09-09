# src/repository/holiday_repo.py
import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from models.attendance import Holiday


def get_holidays(
    db: Session,
    year: int | None = None,
    region: str | None = None,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[int, list[Holiday]]:
    """Lists holidays filtered by year and/or region."""
    conditions = []
    if year:
        conditions.append(Holiday.year == year)
    if region and region.upper() != "ALL":
        conditions.append(
            (func.upper(Holiday.applicable_region) == region.strip().upper())
            | (func.upper(Holiday.applicable_region) == "ALL")
        )

    count_stmt = select(func.count()).select_from(Holiday)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total = db.scalar(count_stmt) or 0

    stmt = select(Holiday).order_by(Holiday.date).offset(skip)
    if conditions:
        stmt = stmt.where(*conditions)
    if limit is not None:
        stmt = stmt.limit(limit)

    items = list(db.scalars(stmt).all())
    return total, items


def get_holiday_by_public_id(public_id: str, db: Session) -> Holiday | None:
    """Finds holiday by public UUID."""
    if not public_id:
        return None
    return db.scalar(select(Holiday).where(Holiday.public_id == public_id))


def create_holiday(
    name: str,
    date_val: datetime.date,
    db: Session,
    holiday_type: str = "company",
    year: int = 2026,
    is_optional: bool = False,
    applicable_region: str = "ALL",
) -> Holiday:
    """Creates a holiday record."""
    holiday = Holiday(
        name=name.strip(),
        date=date_val,
        holiday_type=holiday_type.strip().lower(),
        year=year,
        is_optional=is_optional,
        applicable_region=applicable_region.strip(),
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


def delete_holiday(public_id: str, db: Session) -> bool:
    """Deletes a holiday."""
    holiday = get_holiday_by_public_id(public_id, db=db)
    if not holiday:
        return False
    db.delete(holiday)
    db.commit()
    return True
