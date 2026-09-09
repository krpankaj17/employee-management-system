# src/repository/attendance_repository.py
import datetime
from datetime import date as py_date, time as py_time
from decimal import Decimal
from typing import Any, cast
import uuid
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import SessionLocal
from models.attendance import Attendance


def _parse_date(val: Any) -> py_date:
    if isinstance(val, py_date):
        return val
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, str):
        return py_date.fromisoformat(val.strip()[:10])
    return py_date.today()


def _parse_datetime(val: Any, target_date: py_date | None = None) -> datetime.datetime | None:
    if not val:
        return None
    if isinstance(val, datetime.datetime):
        return val
    if isinstance(val, py_time):
        base_date = target_date or py_date.today()
        return datetime.datetime.combine(base_date, val)
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        try:
            return datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            pass
        base_date = target_date or py_date.today()
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                t = datetime.datetime.strptime(val, fmt).time()
                return datetime.datetime.combine(base_date, t)
            except ValueError:
                pass
    return None


def get_all(db: Session | None = None) -> list[dict]:
    """Returns every attendance record from PostgreSQL as a list of dicts."""
    def _execute(session: Session) -> list[dict]:
        records = (
            session.query(Attendance)
            .order_by(Attendance.date.desc(), Attendance.attendance_id.desc())
            .all()
        )
        return [r.to_dict() for r in records]

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def get_by_id(a_id: Any, db: Session | None = None) -> dict | None:
    """Returns the attendance record matching public_id UUID or integer attendance_id, or None."""
    def _execute(session: Session) -> dict | None:
        str_id = str(a_id).strip()
        try:
            uuid_obj = uuid.UUID(str_id)
            rec = session.query(Attendance).filter(Attendance.public_id == uuid_obj).first()
            if rec:
                return rec.to_dict()
        except (ValueError, AttributeError):
            pass

        if str_id.isdigit():
            rec = session.query(Attendance).filter(Attendance.attendance_id == int(str_id)).first()
            if rec:
                return rec.to_dict()

        return None

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def get_by_employee_id(e_id: int, db: Session | None = None) -> list[dict]:
    """Returns all attendance records for a given employee id."""
    def _execute(session: Session) -> list[dict]:
        records = (
            session.query(Attendance)
            .filter(Attendance.emp_id == int(e_id))
            .order_by(Attendance.date.desc())
            .all()
        )
        return [r.to_dict() for r in records]

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def get_by_employee_and_date(e_id: int, date_str: Any, db: Session | None = None) -> list[dict]:
    """Returns all attendance records for an employee on a specific date."""
    parsed_date = _parse_date(date_str)

    def _execute(session: Session) -> list[dict]:
        records = (
            session.query(Attendance)
            .filter(Attendance.emp_id == int(e_id), Attendance.date == parsed_date)
            .order_by(Attendance.attendance_id.desc())
            .all()
        )
        return [r.to_dict() for r in records]

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def get_open_check_in(e_id: int, date_str: Any = None, db: Session | None = None) -> dict | None:
    """Returns the active record where check_in exists but check_out is None."""
    parsed_date = _parse_date(date_str) if date_str else None

    def _execute(session: Session) -> dict | None:
        q = session.query(Attendance).filter(
            Attendance.emp_id == int(e_id),
            Attendance.check_in.isnot(None),
            Attendance.check_out.is_(None),
        )
        if parsed_date:
            q = q.filter(Attendance.date == parsed_date)
        rec = q.order_by(Attendance.check_in.desc()).first()
        return rec.to_dict() if rec else None

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def get_past_unclosed_check_ins(
    e_id: int | None = None,
    before_date_str: Any = None,
    db: Session | None = None,
) -> list[dict]:
    """Returns all attendance records where check_in exists, check_out is None, and date < before_date."""
    ref_date = _parse_date(before_date_str) if before_date_str else py_date.today()

    def _execute(session: Session) -> list[dict]:
        q = session.query(Attendance).filter(
            Attendance.check_in.isnot(None),
            Attendance.check_out.is_(None),
            Attendance.date < ref_date,
        )
        if e_id is not None:
            q = q.filter(Attendance.emp_id == int(e_id))
        records = q.order_by(Attendance.date.asc(), Attendance.attendance_id.asc()).all()
        return [r.to_dict() for r in records]

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def next_id(db: Session | None = None) -> int:
    """Returns the next available attendance_id."""
    def _execute(session: Session) -> int:
        max_id = session.query(func.max(Attendance.attendance_id)).scalar() or 0
        return max_id + 1

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def add(record: dict, db: Session | None = None) -> dict:
    """Creates a new attendance record in PostgreSQL and returns its dictionary representation."""
    def _execute(session: Session) -> dict:
        parsed_date = _parse_date(record.get("date"))
        cin = _parse_datetime(record.get("check_in") or record.get("check_in_time"), target_date=parsed_date)
        cout = _parse_datetime(record.get("check_out") or record.get("check_out_time"), target_date=parsed_date)

        total_hours = None
        if record.get("total_hours") is not None:
            total_hours = Decimal(str(record["total_hours"]))

        pid_val = None
        if record.get("public_id"):
            try:
                pid_val = uuid.UUID(str(record["public_id"]))
            except (ValueError, AttributeError):
                pid_val = uuid.uuid4()
        else:
            pid_val = uuid.uuid4()

        att = Attendance(
            public_id=pid_val,
            emp_id=int(record.get("employee_id") or record.get("emp_id")),
            date=parsed_date,
            check_in=cin,
            check_out=cout,
            work_mode=record.get("work_mode") or "in_office",
            status=record.get("status") or "present",
            total_hours=total_hours,
            notes=record.get("notes"),
            timezone=record.get("timezone") or "UTC",
        )
        session.add(att)
        session.commit()
        session.refresh(att)
        res = att.to_dict()
        if "is_late" in record:
            res["is_late"] = record["is_late"]
        if "late_minutes" in record:
            res["late_minutes"] = record["late_minutes"]
        return res

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


create = add


def update(a_id: Any, updated_fields: dict, db: Session | None = None) -> dict | None:
    """Updates fields of an existing attendance record in PostgreSQL."""
    def _execute(session: Session) -> dict | None:
        str_id = str(a_id).strip()
        rec = None
        try:
            uuid_obj = uuid.UUID(str_id)
            rec = session.query(Attendance).filter(Attendance.public_id == uuid_obj).first()
        except (ValueError, AttributeError):
            pass

        if not rec and str_id.isdigit():
            rec = session.query(Attendance).filter(Attendance.attendance_id == int(str_id)).first()

        if rec is None:
            return None

        if "date" in updated_fields and updated_fields["date"]:
            rec.date = _parse_date(updated_fields["date"])

        target_date = rec.date
        if "check_in" in updated_fields or "check_in_time" in updated_fields:
            val = updated_fields.get("check_in") or updated_fields.get("check_in_time")
            rec.check_in = _parse_datetime(val, target_date=target_date)

        if "check_out" in updated_fields or "check_out_time" in updated_fields:
            val = updated_fields.get("check_out") or updated_fields.get("check_out_time")
            rec.check_out = _parse_datetime(val, target_date=target_date)

        if "total_hours" in updated_fields and updated_fields["total_hours"] is not None:
            rec.total_hours = Decimal(str(updated_fields["total_hours"]))

        if "status" in updated_fields and updated_fields["status"]:
            rec.status = updated_fields["status"]

        if "work_mode" in updated_fields and updated_fields["work_mode"]:
            rec.work_mode = updated_fields["work_mode"]

        if "notes" in updated_fields:
            rec.notes = updated_fields["notes"]

        if "timezone" in updated_fields and updated_fields["timezone"]:
            rec.timezone = updated_fields["timezone"]

        rec.updated_at = datetime.datetime.now(datetime.timezone.utc)
        session.commit()
        session.refresh(rec)
        res = rec.to_dict()
        if "is_late" in updated_fields:
            res["is_late"] = updated_fields["is_late"]
        return res

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def delete(a_id: Any, db: Session | None = None) -> dict | None:
    """Removes the record with matching public_id or id. Returns the deleted record dict, or None if not found."""
    def _execute(session: Session) -> dict | None:
        str_id = str(a_id).strip()
        rec = None
        try:
            uuid_obj = uuid.UUID(str_id)
            rec = session.query(Attendance).filter(Attendance.public_id == uuid_obj).first()
        except (ValueError, AttributeError):
            pass

        if not rec and str_id.isdigit():
            rec = session.query(Attendance).filter(Attendance.attendance_id == int(str_id)).first()

        if rec is None:
            return None

        result_dict = rec.to_dict()
        session.delete(rec)
        session.commit()
        return result_dict

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def delete_by_employee_id(e_id: int, db: Session | None = None) -> int:
    """Removes all attendance records associated with an employee id. Returns count of deleted records."""
    def _execute(session: Session) -> int:
        deleted_count = (
            session.query(Attendance)
            .filter(Attendance.emp_id == int(e_id))
            .delete(synchronize_session=False)
        )
        session.commit()
        return deleted_count

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)
