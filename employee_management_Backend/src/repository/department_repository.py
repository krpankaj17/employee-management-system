#department_repository.py
import json
import datetime

DATA_FILE = "file/DEPARTMENT_DATA.json"


def _load():
    """Reads the raw JSON file. Returns an empty list if it doesn't exist
    yet. This is the ONLY function in this module that touches the file
    directly."""
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as myfile:
            return json.load(myfile)
    except FileNotFoundError:
        return []


def _save(data):
    """Writes the full record list back to the JSON file."""
    with open(DATA_FILE, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4, default=str)


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def get_all():
    """Returns every department, unfiltered and unsorted, exactly as stored."""
    return _load()


def get_by_id(d_id):
    """Returns the department with this id, or None. d_id must already be
    an int — the repository does no type coercion."""
    for department in _load():
        if department["id"] == d_id:
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
    """Appends a fully-formed record (id already assigned), stamps
    created_at/updated_at, and persists it. Returns the record as stored."""
    data = _load()
    timestamp = _now()
    department["created_at"] = timestamp
    department["updated_at"] = timestamp
    data.append(department)
    _save(data)
    return department


def update(d_id, updated_fields):
    """Merges `updated_fields` into the record with id `d_id`, refreshes
    updated_at, and persists it. Returns the updated record, or None if no
    such id exists."""
    data = _load()
    department_record = next((d for d in data if d["id"] == d_id), None)
    if department_record is None:
        return None
    department_record.update(updated_fields)
    department_record["updated_at"] = _now()
    _save(data)
    return department_record


def delete(d_id):
    """Removes the record with id `d_id`. Returns the deleted record, or
    None if no such id exists. No dependency checking here — that's a
    business rule, so it lives in the service layer."""
    data = _load()
    department_record = next((d for d in data if d["id"] == d_id), None)
    if department_record is None:
        return None
    data.remove(department_record)
    _save(data)
    return department_record