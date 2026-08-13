#department_services.py
import utils
from repository import department_repository as repo
from repository import employee_repository as emp_repo


def get_all_records(skip=0, limit=None):
    data = repo.get_all()
    total = len(data)
    paged = data[skip: skip + limit] if limit is not None else data[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": paged}


def get_record_by_id(d_id):
    d_id = utils.convert_string_to_integer(d_id) if isinstance(d_id, str) else d_id
    return repo.get_by_id(d_id)


def get_department_choices():
    """Returns a list of (label, id) tuples for every department, used to
    build a questionary select list."""
    return [(f'{d["id"]} - {d["name"]}', d["id"]) for d in repo.get_all()]


def _name_taken(name, exclude_id=None):
    """Case-insensitive department-name uniqueness check, excluding the
    record currently being updated (if any)."""
    name = name.strip().lower()
    for department in repo.get_all():
        if department["id"] == exclude_id:
            continue
        if department.get("name", "").strip().lower() == name:
            return True
    return False


def _validate_common_fields(d_id, name, head_employee_id):
    """Shared validation for create and update. Returns None if every field
    is valid, or {"error": ..., "message": ...} describing the first
    failure found."""
    if utils.is_none(name):
        return {"error": "validation", "message": "Department name is empty or null"}
    if utils.is_integer(name):
        return {"error": "validation", "message": "Department name must be Text, Integer not allowed"}
    if _name_taken(name, exclude_id=d_id):
        return {"error": "validation", "message": f"Department name '{name}' is already in use"}

    if head_employee_id is not None and not utils.is_none(head_employee_id):
        if not utils.is_positive_integer(head_employee_id):
            return {"error": "validation", "message": "Invalid head_employee_id"}
        head_id = utils.convert_string_to_integer(head_employee_id)
        if emp_repo.get_by_id(head_id) is None:
            existing_ids = sorted(e["id"] for e in emp_repo.get_all())
            return {
                "error": "validation",
                "message": f"Employee with id {head_id} does not exist. Existing employee ids: {existing_ids}",
            }

    return None


def create_new_record(name, head_employee_id=None):
    """Returns a dict: {"ok": True, "record": department} on success,
    or {"ok": False, "error": "validation" | "server", "message": str} on failure."""
    try:
        error = _validate_common_fields(None, name, head_employee_id)
        if error:
            utils.log_action("DEPT_CREATE_FAILED", error["message"])
            return {"ok": False, **error}

        new_department = {
            "id": repo.next_id(),
            "name": name.strip(),
            "head_employee_id": (
                utils.convert_string_to_integer(head_employee_id)
                if head_employee_id is not None and not utils.is_none(head_employee_id)
                else None
            ),
        }
        repo.add(new_department)

        utils.log_action("DEPT_CREATE", f"id={new_department['id']} name={name}")
        return {"ok": True, "record": new_department}
    except Exception as e:
        utils.log_action("DEPT_CREATE_FAILED", f"unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def update_records(d_id, name, head_employee_id=None):
    """Returns a dict: {"ok": True, "record": department} on success,
    or {"ok": False, "error": "not_found" | "validation" | "server", "message": str} on failure."""
    try:
        d_id = utils.convert_string_to_integer(d_id) if isinstance(d_id, str) else d_id

        before = repo.get_by_id(d_id)
        if before is None:
            msg = f"Department record does not exist with id {d_id}"
            utils.log_action("DEPT_UPDATE_FAILED", f"id={d_id} does not exist")
            return {"ok": False, "error": "not_found", "message": msg}

        error = _validate_common_fields(d_id, name, head_employee_id)
        if error:
            utils.log_action("DEPT_UPDATE_FAILED", f"id={d_id} {error['message']}")
            return {"ok": False, **error}

        updated_fields = {
            "name": name.strip(),
            "head_employee_id": (
                utils.convert_string_to_integer(head_employee_id)
                if head_employee_id is not None and not utils.is_none(head_employee_id)
                else None
            ),
        }
        after = repo.update(d_id, updated_fields)

        utils.log_action("DEPT_UPDATE", f"id={d_id} before={before} after={after}")
        return {"ok": True, "record": after}
    except Exception as e:
        utils.log_action("DEPT_UPDATE_FAILED", f"id={d_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def delete_record(d_id):
    """Blocks deletion if any employee still references this department —
    otherwise you'd end up with employees pointing at a department_id that
    no longer exists, silently breaking every downstream lookup."""
    try:
        d_id = utils.convert_string_to_integer(d_id) if isinstance(d_id, str) else d_id

        if repo.get_by_id(d_id) is None:
            utils.log_action("DEPT_DELETE_FAILED", f"id={d_id} does not exist")
            return {"ok": False, "error": "not_found", "message": f"Department with id {d_id} not found"}

        dependent_count = sum(1 for e in emp_repo.get_all() if e.get("department_id") == d_id)
        if dependent_count > 0:
            msg = f"Cannot delete department {d_id}: {dependent_count} employee(s) still assigned to it"
            utils.log_action("DEPT_DELETE_FAILED", msg)
            return {"ok": False, "error": "conflict", "message": msg}

        deleted = repo.delete(d_id)
        utils.log_action("DEPT_DELETE", f"id={d_id} record={deleted}")
        return {"ok": True, "details": f"Department with id {d_id} deleted"}
    except Exception as e:
        utils.log_action("DEPT_DELETE_FAILED", f"id={d_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def get_department_employees(d_id, skip=0, limit=None):
    """Returns every employee assigned to this department. Returns None if
    d_id doesn't correspond to any department."""
    d_id = utils.convert_string_to_integer(d_id) if isinstance(d_id, str) else d_id
    if repo.get_by_id(d_id) is None:
        return None
    matches = [e for e in emp_repo.get_all() if e.get("department_id") == d_id]
    total = len(matches)
    paged = matches[skip: skip + limit] if limit is not None else matches[skip:]
    return {"department_id": d_id, "total": total, "skip": skip, "limit": limit, "items": paged}