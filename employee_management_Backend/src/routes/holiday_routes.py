# src/routes/holiday_routes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from core.permissions import require_permission
from schemas.attendance_schema import HolidayIn, HolidayOut, PaginatedHolidays
from services import holiday_service

router = APIRouter(prefix="/holidays", tags=["Holiday Calendar"])


@router.get("", response_model=PaginatedHolidays, dependencies=[Depends(require_permission("attendance:read"))])
def list_holidays(
    year: int | None = Query(None, ge=2000, le=2100, description="Year filter"),
    region: str | None = Query(None, description="Region filter e.g. National, Karnataka, ALL"),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """Lists company holidays by year and region. Requires 'attendance:read' permission."""
    return holiday_service.get_holidays(year=year, region=region, skip=skip, limit=limit, db=db)


@router.post("", response_model=HolidayOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("attendance:update"))])
def create_holiday(payload: HolidayIn, db: Session = Depends(get_db)):
    """Creates a holiday entry. Requires 'attendance:update' permission."""
    result = holiday_service.create_holiday(payload, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result["holiday"]


@router.delete("/{public_id}", dependencies=[Depends(require_permission("attendance:update"))])
def delete_holiday(public_id: str, db: Session = Depends(get_db)):
    """Deletes a holiday entry. Requires 'attendance:update' permission."""
    result = holiday_service.delete_holiday(public_id, db=db)
    if not result["ok"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return {"details": result["details"]}
