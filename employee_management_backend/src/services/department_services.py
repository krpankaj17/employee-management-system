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
    """Internal use — looks up by integer dept_id."""
    d_id = utils.convert_string_to_integer(d_id) if isinstance(d_id, str) else d_id
    return repo.get_by_id(d_id)


def get_record_by_public_id(public_id, db=None):
    """Looks up a department by public UUID."""
    if utils.is_none(public_id):
        return None
    return repo.get_by_public_id(public_id, db=db)


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


def _validate_common_fields(d_id, name, head_employee_public_id):
    """Shared validation for create and update. Returns None if every field
    is valid, or {"error": ..., "message": ...} describing the first
    failure found. Uses public_id UUID for head_employee reference."""
    if utils.is_none(name):
        return {"error": "validation", "message": "Department name is empty or null"}
    if utils.is_integer(name):
        return {"error": "validation", "message": "Department name must be Text, Integer not allowed"}
    if _name_taken(name, exclude_id=d_id):
        return {"error": "validation", "message": f"Department name '{name}' is already in use"}

    if head_employee_public_id is not None and not utils.is_none(head_employee_public_id):
        # Resolve UUID to internal employee
        emp = emp_repo.get_by_email(head_employee_public_id)  # not email, try public_id
        # Actually look up by public_id from all employees
        all_emps = emp_repo.get_all()
        found = None
        for e in all_emps:
            if e.get("public_id") == head_employee_public_id:
                found = e
                break
        if found is None:
            return {
                "error": "validation",
                "message": f"Employee with public_id '{head_employee_public_id}' does not exist",
            }

    return None


def _resolve_head_employee_uuid(public_id):
    """Resolves head_employee public_id UUID to internal emp_id."""
    if public_id is None or utils.is_none(public_id):
        return None
    all_emps = emp_repo.get_all()
    for e in all_emps:
        if e.get("public_id") == public_id:
            return e.get("emp_id") or e.get("id")
    return None


def create_new_record(name, head_employee_public_id=None):
    """Returns a dict: {"ok": True, "record": department} on success,
    or {"ok": False, "error": "validation" | "server", "message": str} on failure."""
    try:
        error = _validate_common_fields(None, name, head_employee_public_id)
        if error:
            utils.log_action("DEPT_CREATE_FAILED", error["message"])
            return {"ok": False, **error}

        head_emp_id = _resolve_head_employee_uuid(head_employee_public_id)

        new_department = {
            "id": repo.next_id(),
            "name": name.strip(),
            "head_employee_id": head_emp_id,
        }
        repo.add(new_department)

        utils.log_action("DEPT_CREATE", f"id={new_department['id']} name={name}")
        return {"ok": True, "record": new_department}
    except Exception as e:
        utils.log_action("DEPT_CREATE_FAILED", f"unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def update_records(public_id, name, head_employee_public_id=None):
    """Updates department by public_id UUID."""
    try:
        dept = repo.get_by_public_id(public_id)
        if dept is None:
            msg = f"Department with public_id '{public_id}' does not exist"
            utils.log_action("DEPT_UPDATE_FAILED", msg)
            return {"ok": False, "error": "not_found", "message": msg}

        d_id = dept["id"]

        error = _validate_common_fields(d_id, name, head_employee_public_id)
        if error:
            utils.log_action("DEPT_UPDATE_FAILED", f"public_id={public_id} {error['message']}")
            return {"ok": False, **error}

        head_emp_id = _resolve_head_employee_uuid(head_employee_public_id)

        updated_fields = {
            "name": name.strip(),
            "head_employee_id": head_emp_id,
        }
        after = repo.update(d_id, updated_fields)

        utils.log_action("DEPT_UPDATE", f"public_id={public_id} updated")
        return {"ok": True, "record": after}
    except Exception as e:
        utils.log_action("DEPT_UPDATE_FAILED", f"public_id={public_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def delete_record(public_id):
    """Deletes department by public_id UUID. Blocks if employees still assigned."""
    try:
        dept = repo.get_by_public_id(public_id)
        if dept is None:
            utils.log_action("DEPT_DELETE_FAILED", f"public_id={public_id} does not exist")
            return {"ok": False, "error": "not_found", "message": f"Department with public_id '{public_id}' not found"}

        d_id = dept["id"]

        dependent_count = sum(1 for e in emp_repo.get_all() if e.get("dept_id") == d_id)
        if dependent_count > 0:
            msg = f"Cannot delete department '{public_id}': {dependent_count} employee(s) still assigned to it"
            utils.log_action("DEPT_DELETE_FAILED", msg)
            return {"ok": False, "error": "conflict", "message": msg}

        deleted = repo.delete(d_id)
        utils.log_action("DEPT_DELETE", f"public_id={public_id} deleted")
        return {"ok": True, "details": f"Department with public_id '{public_id}' deleted"}
    except Exception as e:
        utils.log_action("DEPT_DELETE_FAILED", f"public_id={public_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def get_department_employees(public_id, skip=0, limit=None):
    """Returns every employee assigned to this department (identified by public_id UUID).
    Returns None if public_id doesn't correspond to any department."""
    dept = repo.get_by_public_id(public_id)
    if dept is None:
        return None
    d_id = dept["id"]
    dept_public_id = dept.get("public_id", public_id)
    matches = [e for e in emp_repo.get_all() if e.get("dept_id") == d_id]
    total = len(matches)
    paged = matches[skip: skip + limit] if limit is not None else matches[skip:]
    return {"department_public_id": dept_public_id, "total": total, "skip": skip, "limit": limit, "items": paged}