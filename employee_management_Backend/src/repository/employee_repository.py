#employee_repository.py
import json
import datetime

DATA_FILE = "file/MOCK_DATA.json"


def _load():
    """Reads the raw JSON file. Returns an empty list if it doesn't exist
    yet. This is the ONLY function in the app that touches the file
    directly."""
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as myfile:
            return json.load(myfile)
    except FileNotFoundError:
        return []


def _save(data):
    """Writes the full record list back to the JSON file. default=str
    handles any datetime.date objects that slip through unconverted."""
    with open(DATA_FILE, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4, default=str)


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def get_all():
    """Returns every record, unfiltered and unsorted, exactly as stored."""
    return _load()


def get_by_id(e_id):
    """Returns the record with this id, or None. e_id must already be an
    int — the repository does no type coercion."""
    for employee in _load():
        if employee["id"] == e_id:
            return employee
    return None


def next_id():
    """Returns the next available id (max existing id + 1)."""
    return max((employee["id"] for employee in _load()), default=0) + 1


def add(employee):
    """Appends a fully-formed record (id already assigned), stamps
    created_at/updated_at, and persists it. Returns the record as stored."""
    data = _load()
    timestamp = _now()
    employee["created_at"] = timestamp
    employee["updated_at"] = timestamp
    data.append(employee)
    _save(data)
    return employee


def update(e_id, updated_fields):
    """Merges `updated_fields` into the record with id `e_id`, refreshes
    updated_at, and persists it. Returns the updated record, or None if no
    such id exists."""
    data = _load()
    employee_record = next((e for e in data if e["id"] == e_id), None)
    if employee_record is None:
        return None
    employee_record.update(updated_fields)
    employee_record["updated_at"] = _now()
    _save(data)
    return employee_record


def delete(e_id):
    """Removes the record with id `e_id`. Returns the deleted record, or
    None if no such id exists."""
    data = _load()
    employee_record = next((e for e in data if e["id"] == e_id), None)
    if employee_record is None:
        return None
    data.remove(employee_record)
    _save(data)
    return employee_record
def get_by_email(email):
    """Returns the record with this email (case-insensitive), or None."""
    email = email.strip().lower()
    for employee in _load():
        if employee.get("email", "").strip().lower() == email:
            return employee
    return None