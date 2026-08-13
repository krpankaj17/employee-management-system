#employee_services.py
import utils
from repository import employee_repository as repo
from repository import department_repository as dept_repo

SORT_KEYS = {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Department": "department_id",
    "Joining Date": "joining_date",
    "Status": "employee_status",
}


def get_all_records(skip=0, limit=None):
    data = repo.get_all()
    total = len(data)
    paged = data[skip: skip + limit] if limit is not None else data[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": paged}


def get_record_by_id(e_id):
    e_id = utils.convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id
    return repo.get_by_id(e_id)


def get_record_by_email(email):
    if utils.is_none(email):
        return None
    return repo.get_by_email(email)


def get_direct_reports(manager_id):
    """Returns every employee whose reporting_manager_id matches manager_id.
    Returns None if manager_id doesn't correspond to any employee, so the
    route can tell 'manager not found' apart from 'manager has 0 reports'."""
    manager_id = utils.convert_string_to_integer(manager_id) if isinstance(manager_id, str) else manager_id
    if repo.get_by_id(manager_id) is None:
        return None
    reports = [e for e in repo.get_all() if e.get("reporting_manager_id") == manager_id]
    return {"manager_id": manager_id, "count": len(reports), "reports": reports}


def get_record_choices():
    """Returns a list of (label, id) tuples for every employee, used to
    build a questionary select list."""
    return [(f'{e["id"]} - {e["first_name"]} {e["last_name"]}', e["id"]) for e in repo.get_all()]


def _email_taken(email, exclude_id=None):
    """Case-insensitive email uniqueness check across all employees,
    excluding the record currently being updated (if any)."""
    email = email.strip().lower()
    for employee in repo.get_all():
        if employee["id"] == exclude_id:
            continue
        if employee.get("email", "").strip().lower() == email:
            return True
    return False


def _validate_common_fields(e_id, first_name, last_name, dob, email, phone, address, pincode,
                             department_id, joining_date, employee_status, reporting_manager_id):
    """Shared validation for create and update. Returns None if every field
    is valid, or {"error": ..., "message": ...} describing the first
    failure found."""
    if utils.is_none(first_name):
        return {"error": "validation", "message": "First name is empty or null"}
    if utils.is_integer(first_name):
        return {"error": "validation", "message": "First name must be Text, Integer not allowed"}

    if utils.is_none(last_name):
        return {"error": "validation", "message": "Last name is empty or null"}
    if utils.is_integer(last_name):
        return {"error": "validation", "message": "Last name must be Text, Integer not allowed"}

    if not utils.is_valid_date(dob):
        return {"error": "validation", "message": "Invalid date of birth, expected format YYYY-MM-DD"}
    if not utils.is_not_future_date(dob):
        return {"error": "validation", "message": "Date of birth cannot be in the future"}

    if not utils.is_valid_email(email):
        return {"error": "validation", "message": "Invalid email address"}
    if _email_taken(email, exclude_id=e_id):
        return {"error": "validation", "message": f"Email '{email}' is already in use"}

    if not utils.is_valid_phone(phone):
        return {"error": "validation", "message": "Invalid phone number, must be exactly 10 digits"}

    if utils.is_none(address):
        return {"error": "validation", "message": "Address is empty or null"}

    if not utils.is_valid_pincode(pincode):
        return {"error": "validation", "message": "Invalid pincode"}

    if not utils.is_positive_integer(department_id):
        return {"error": "validation", "message": "Invalid department id"}
    dept_id = utils.convert_string_to_integer(department_id) if isinstance(department_id, str) else department_id
    if dept_repo.get_by_id(dept_id) is None:
        existing_ids = sorted(d["id"] for d in dept_repo.get_all())
        return {
            "error": "validation",
            "message": f"Department with id {dept_id} does not exist. Existing department ids: {existing_ids}",
        }

    if not utils.is_valid_date(joining_date):
        return {"error": "validation", "message": "Invalid joining date, expected format YYYY-MM-DD"}

    if not utils.is_valid_employee_status(employee_status):
        return {"error": "validation", "message": f"Employee status must be one of {sorted(utils.VALID_EMPLOYEE_STATUSES)}"}

    if reporting_manager_id is not None and not utils.is_none(reporting_manager_id):
        if not utils.is_positive_integer(reporting_manager_id):
            return {"error": "validation", "message": "Invalid reporting manager id"}
        manager_id = utils.convert_string_to_integer(reporting_manager_id)
        if manager_id == e_id:
            return {"error": "validation", "message": "An employee cannot be their own reporting manager"}
        if repo.get_by_id(manager_id) is None:
            existing_ids = sorted(e["id"] for e in repo.get_all())
            return {
                "error": "validation",
                "message": f"Reporting manager with id {manager_id} does not exist. Existing employee ids: {existing_ids}",
            }

    return None


def create_new_record(first_name, last_name, dob, email, phone, address, pincode,
                       department_id, joining_date, employee_status, reporting_manager_id=None):
    """Returns a dict: {"ok": True, "record": employee} on success,
    or {"ok": False, "error": "validation" | "server", "message": str} on failure."""
    try:
        error = _validate_common_fields(
            None, first_name, last_name, dob, email, phone, address, pincode,
            department_id, joining_date, employee_status, reporting_manager_id,
        )
        if error:
            utils.log_action("CREATE_FAILED", error["message"])
            return {"ok": False, **error}

        new_employee = {
            "id": repo.next_id(),
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "dob": str(utils.convert_string_to_date(dob)),
            "email": email.strip().lower(),
            "phone": phone.strip(),
            "address": address.strip(),
            "pincode": utils.convert_string_to_integer(pincode) if isinstance(pincode, str) else pincode,
            "department_id": utils.convert_string_to_integer(department_id) if isinstance(department_id, str) else department_id,
            "joining_date": str(utils.convert_string_to_date(joining_date)),
            "employee_status": employee_status.strip().lower(),
            "reporting_manager_id": (
                utils.convert_string_to_integer(reporting_manager_id)
                if reporting_manager_id is not None and not utils.is_none(reporting_manager_id)
                else None
            ),
        }
        repo.add(new_employee)

        utils.log_action("CREATE", f"id={new_employee['id']} name={first_name} {last_name} email={email}")
        return {"ok": True, "record": new_employee}
    except Exception as e:
        utils.log_action("CREATE_FAILED", f"unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def update_records(e_id, first_name, last_name, dob, email, phone, address, pincode,
                    department_id, joining_date, employee_status, reporting_manager_id=None):
    """Returns a dict: {"ok": True, "record": employee} on success,
    or {"ok": False, "error": "not_found" | "validation" | "server", "message": str} on failure."""
    try:
        e_id = utils.convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id

        before = repo.get_by_id(e_id)
        if before is None:
            msg = f"Employee record does not exist with id {e_id}"
            utils.log_action("UPDATE_FAILED", f"id={e_id} does not exist")
            return {"ok": False, "error": "not_found", "message": msg}

        error = _validate_common_fields(
            e_id, first_name, last_name, dob, email, phone, address, pincode,
            department_id, joining_date, employee_status, reporting_manager_id,
        )
        if error:
            utils.log_action("UPDATE_FAILED", f"id={e_id} {error['message']}")
            return {"ok": False, **error}

        updated_fields = {
            "first_name": first_name.strip(),
            "last_name": last_name.strip(),
            "dob": str(utils.convert_string_to_date(dob)),
            "email": email.strip().lower(),
            "phone": phone.strip(),
            "address": address.strip(),
            "pincode": utils.convert_string_to_integer(pincode) if isinstance(pincode, str) else pincode,
            "department_id": utils.convert_string_to_integer(department_id) if isinstance(department_id, str) else department_id,
            "joining_date": str(utils.convert_string_to_date(joining_date)),
            "employee_status": employee_status.strip().lower(),
            "reporting_manager_id": (
                utils.convert_string_to_integer(reporting_manager_id)
                if reporting_manager_id is not None and not utils.is_none(reporting_manager_id)
                else None
            ),
        }
        after = repo.update(e_id, updated_fields)

        utils.log_action("UPDATE", f"id={e_id} before={before} after={after}")
        return {"ok": True, "record": after}
    except Exception as e:
        utils.log_action("UPDATE_FAILED", f"id={e_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def delete_record(e_id):
    try:
        e_id = utils.convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id
        deleted = repo.delete(e_id)

        if deleted is None:
            utils.log_action("DELETE_FAILED", f"id={e_id} does not exist")
            return None

        utils.log_action("DELETE", f"id={e_id} record={deleted}")
        return {"details": f"Employee with id {e_id} deleted"}
    except Exception as e:
        utils.log_action("DELETE_FAILED", f"id={e_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def search_records(first_name=None, last_name=None, department_id=None, employee_status=None,
                    min_joining_date=None, max_joining_date=None, skip=0, limit=None):
    """Filtering logic lives HERE, not in the repository.

    - first_name / last_name: case-insensitive substring match
    - department_id / employee_status: exact match
    - min_joining_date / max_joining_date: inclusive bounds (strings in
      YYYY-MM-DD sort correctly lexicographically, so no date parsing needed)
    Any argument left as None is ignored (not filtered on).
    """
    data = repo.get_all()
    results = []
    for employee in data:
        if first_name and first_name.strip().lower() not in employee["first_name"].lower():
            continue
        if last_name and last_name.strip().lower() not in employee["last_name"].lower():
            continue
        if department_id is not None and employee["department_id"] != department_id:
            continue
        if employee_status and employee["employee_status"].lower() != employee_status.strip().lower():
            continue
        if min_joining_date and employee["joining_date"] < min_joining_date:
            continue
        if max_joining_date and employee["joining_date"] > max_joining_date:
            continue
        results.append(employee)

    utils.log_action(
        "SEARCH",
        f"first_name={first_name!r} last_name={last_name!r} department_id={department_id} "
        f"employee_status={employee_status!r} -> {len(results)} match(es)",
    )

    total = len(results)
    paged = results[skip: skip + limit] if limit is not None else results[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": paged}


def sort_records(key="first_name", reverse=False, data=None):
    """Sort-key logic also lives here — the repository just hands back
    raw data, it doesn't know about sort order."""
    if data is None:
        data = repo.get_all()

    def sort_key(employee):
        value = employee.get(key)
        if isinstance(value, str):
            return value.lower()
        return value if value is not None else -1

    sorted_data = sorted(data, key=sort_key, reverse=reverse)
    utils.log_action("SORT", f"key={key} reverse={reverse} -> {len(sorted_data)} record(s)")
    return sorted_data