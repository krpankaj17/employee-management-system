#attendance_repository.py
import json
import datetime
from pathlib import Path

# Resolve data file path relative to repo structure with fallback
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "file" / "ATTENDANCE_DATA.json"


def _load():
    """Reads the raw JSON file. Returns an empty list if it doesn't exist yet."""
    try:
        if DATA_FILE.exists():
            with open(DATA_FILE, "r", encoding="utf-8") as myfile:
                return json.load(myfile)
        # Fallback for relative path
        with open("file/ATTENDANCE_DATA.json", "r", encoding="utf-8") as myfile:
            return json.load(myfile)
    except FileNotFoundError:
        return []


def _save(data):
    """Writes the full record list back to the JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4, default=str)


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def get_all():
    """Returns every attendance record, unfiltered and unsorted."""
    return _load()


def get_by_id(a_id):
    """Returns the attendance record with this id, or None."""
    for record in _load():
        if record["id"] == a_id:
            return record
    return None


def get_by_employee_id(e_id):
    """Returns all attendance records for a given employee id."""
    return [r for r in _load() if r["employee_id"] == e_id]


def get_by_employee_and_date(e_id, date_str):
    """Returns all attendance records for an employee on a specific date."""
    return [r for r in _load() if r["employee_id"] == e_id and r["date"] == date_str]


def get_open_check_in(e_id, date_str):
    """Returns the active record where check_in exists but check_out is None for today."""
    for record in _load():
        if record["employee_id"] == e_id and record["date"] == date_str and record.get("check_out") is None:
            return record
    return None


def next_id():
    """Returns the next available id (max existing id + 1)."""
    return max((record["id"] for record in _load()), default=0) + 1


def add(record):
    """Appends a new attendance record, stamps timestamps, and persists it."""
    data = _load()
    timestamp = _now()
    record["created_at"] = timestamp
    record["updated_at"] = timestamp
    data.append(record)
    _save(data)
    return record


def update(a_id, updated_fields):
    """Merges updated_fields into the record with id a_id, refreshes updated_at, and persists."""
    data = _load()
    record = next((r for r in data if r["id"] == a_id), None)
    if record is None:
        return None
    record.update(updated_fields)
    record["updated_at"] = _now()
    _save(data)
    return record


def delete(a_id):
    """Removes the record with id a_id. Returns the deleted record, or None if not found."""
    data = _load()
    record = next((r for r in data if r["id"] == a_id), None)
    if record is None:
        return None
    data.remove(record)
    _save(data)
    return record


def delete_by_employee_id(e_id):
    """Removes all attendance records associated with an employee id. Returns count of deleted records."""
    data = _load()
    remaining = [r for r in data if r.get("employee_id") != e_id]
    deleted_count = len(data) - len(remaining)
    if deleted_count > 0:
        _save(remaining)
    return deleted_count
