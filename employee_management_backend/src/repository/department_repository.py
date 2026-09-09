# department_repository.py
import json
import datetime
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from database import SessionLocal
from models.department import Department

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "file" / "DEPARTMENT_DATA.json"


def _load_from_db():
    """Fetches all departments from PostgreSQL database via ORM."""
    with SessionLocal() as session:
        depts = session.scalars(select(Department).order_by(Department.dept_id)).all()
        return [
            {
                "id": d.dept_id,
                "public_id": str(d.public_id),
                "dept_code": d.dept_code,
                "name": d.dept_name,
                "description": d.description,
                "head_employee_id": d.head_employee_id,
                "created_at": (
                    d.created_at.isoformat()
                    if hasattr(d.created_at, "isoformat")
                    else str(d.created_at)
                ),
                "updated_at": (
                    d.updated_at.isoformat()
                    if hasattr(d.updated_at, "isoformat")
                    else str(d.updated_at)
                ),
            }
            for d in depts
        ]


def _load_from_file():
    """Reads the raw JSON file. Returns an empty list if it doesn't exist yet."""
    try:
        if DATA_FILE.exists():
            with open(DATA_FILE, "r", encoding="utf-8") as myfile:
                return json.load(myfile)
        with open("file/DEPARTMENT_DATA.json", "r", encoding="utf-8") as myfile:
            return json.load(myfile)
    except FileNotFoundError:
        return []


def _load():
    """Reads department data directly from PostgreSQL database via ORM."""
    try:
        return _load_from_db()
    except Exception:
        return _load_from_file()


def _save(data):
    """Writes the full record list back to the JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4, default=str)


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def get_all():
    """Returns every department, unfiltered and unsorted, exactly as stored."""
    return _load()


def get_by_id(d_id):
    """Returns the department with this internal id, or None."""
    for department in _load():
        if department["id"] == d_id:
            return department
    return None


def get_by_public_id(public_id: str, db: Session | None = None) -> Department | dict | None:
    """Returns the Department ORM object matching the given public UUID."""
    if not public_id:
        return None
    if db is not None:
        stmt = select(Department).where(Department.public_id == public_id)
        dept = db.scalar(stmt)
        if dept is None:
            return None
        return {
            "id": dept.dept_id,
            "public_id": str(dept.public_id),
            "dept_code": dept.dept_code,
            "name": dept.dept_name,
            "description": dept.description,
            "head_employee_id": dept.head_employee_id,
            "created_at": (
                dept.created_at.isoformat()
                if hasattr(dept.created_at, "isoformat")
                else str(dept.created_at)
            ),
            "updated_at": (
                dept.updated_at.isoformat()
                if hasattr(dept.updated_at, "isoformat")
                else str(dept.updated_at)
            ),
        }

    for department in _load():
        if department.get("public_id") == public_id:
            return department
    return None


def get_by_name(name):
    """Returns the department with this name (case-insensitive), or None."""
    name = name.strip().lower()
    for department in _load():
        if department.get("name", "").strip().lower() == name:
            return department
    return None


def next_id():
    """Returns the next available id (max existing id + 1)."""
    return max((department["id"] for department in _load()), default=0) + 1


def add(department):
    """Appends a fully-formed record, stamps created_at/updated_at, and persists it."""
    data = _load()
    timestamp = _now()
    department["created_at"] = timestamp
    department["updated_at"] = timestamp
    data.append(department)
    _save(data)
    return department


def update(d_id, updated_fields):
    """Merges updated_fields into the record with id d_id, refreshes updated_at, and persists it."""
    data = _load()
    dept = next((d for d in data if d["id"] == d_id), None)
    if dept is None:
        return None
    dept.update(updated_fields)
    dept["updated_at"] = _now()
    _save(data)
    return dept


def delete(d_id):
    """Removes the record with id d_id. Returns the deleted record, or None if no such id exists."""
    data = _load()
    dept = next((d for d in data if d["id"] == d_id), None)
    if dept is None:
        return None
    data.remove(dept)
    _save(data)
    return dept