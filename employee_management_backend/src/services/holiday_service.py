# src/services/holiday_service.py
import datetime
import utils
from sqlalchemy.orm import Session
from core.cache import get_cached_or_compute, invalidate_cache
from repository import holiday_repo
from schemas.attendance_schema import HolidayIn


def get_holidays(
    skip: int = 0,
    limit: int | None = None,
    year: int | None = None,
    region: str | None = None,
    db: Session = None,  # type: ignore
) -> dict:
    def _fetch():
        total, items = holiday_repo.get_holidays(db=db, year=year, region=region, skip=skip, limit=limit)
        return {"total": total, "skip": skip, "limit": limit, "items": [h.to_dict() for h in items]}

    cache_key = f"{year or 'all'}_{region or 'all'}_{skip}_{limit}"
    return get_cached_or_compute("holidays", cache_key, _fetch)


def create_holiday(payload: HolidayIn, db: Session) -> dict:
    if not utils.is_valid_date(payload.date):
        return {"ok": False, "error": "validation", "message": "Invalid date format, expected YYYY-MM-DD"}

    date_obj = datetime.date.fromisoformat(payload.date.strip())
    year_val = payload.year if payload.year is not None else date_obj.year
    holiday = holiday_repo.create_holiday(
        name=payload.name,
        date_val=date_obj,
        holiday_type=payload.holiday_type,
        year=year_val,
        is_optional=payload.is_optional,
        applicable_region=payload.applicable_region,
        db=db,
    )
    invalidate_cache("holidays")
    utils.log_action("HOLIDAY_CREATED", f"name={holiday.name} date={holiday.date}")
    return {"ok": True, "holiday": holiday.to_dict()}


def delete_holiday(public_id: str, db: Session) -> dict:
    success = holiday_repo.delete_holiday(public_id, db=db)
    if not success:
        return {"ok": False, "error": "not_found", "message": f"Holiday with public_id '{public_id}' not found"}
    invalidate_cache("holidays")
    utils.log_action("HOLIDAY_DELETED", f"public_id={public_id}")
    return {"ok": True, "details": f"Holiday with public_id '{public_id}' deleted"}
