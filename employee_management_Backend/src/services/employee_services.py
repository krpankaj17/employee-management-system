# employee_services.py
import datetime
import utils
from sqlalchemy import select
from sqlalchemy.orm import Session
from repository import employee_repository as repo
from repository import department_repository as dept_repo
from repository import attendance_repository as att_repo
from models.department import Department
from models.designation import Designation
from schemas.employee_schema import EmployeeIn

VALID_GENDERS = {"male", "female", "other", "prefer_not_to_say"}
VALID_EMPLOYEE_STATUSES = {"active", "inactive", "on_leave", "terminated", "resigned"}
VALID_EMPLOYMENT_TYPES = {"full_time", "part_time", "contract", "intern"}


# ─── UUID → Internal ID Resolution ─────────────────────────────────────────────

def _resolve_department_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves department public_id UUID → internal dept_id.
    Returns (dept_id, error_message). error_message is None on success."""
    if not public_id:
        return None, None
    dept = db.scalar(select(Department).where(Department.public_id == public_id))
    if dept is None:
        return None, f"Department with public_id '{public_id}' does not exist"
    return dept.dept_id, None


def _resolve_designation_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves designation public_id UUID → internal designation_id."""
    if not public_id:
        return None, None
    desig = db.scalar(select(Designation).where(Designation.public_id == public_id))
    if desig is None:
        return None, f"Designation with public_id '{public_id}' does not exist"
    return desig.designation_id, None


def _resolve_manager_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves reporting_manager public_id UUID → internal emp_id."""
    if not public_id:
        return None, None
    manager = repo.get_by_public_id(public_id, db=db)
    if manager is None:
        return None, f"Reporting manager with public_id '{public_id}' does not exist"
    return manager.emp_id, None


# ─── Public API ─────────────────────────────────────────────────────────────────

def get_all_records(skip=0, limit=None, db=None):
    if db is not None:
        total, items = repo.get_paginated(db=db, skip=skip, limit=limit)
        return {"total": total, "skip": skip, "limit": limit, "items": items}
    data = repo.get_all()
    total = len(data)
    paged = data[skip: skip + limit] if limit is not None else data[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": paged}


def search_records(
    first_name=None,
    last_name=None,
    department_public_id=None,
    designation_public_id=None,
    employee_status=None,
    employment_type=None,
    gender=None,
    min_joining_date=None,
    max_joining_date=None,
    skip=0,
    limit=None,
    db=None,
):
    if db is not None:
        # Resolve UUID query params to internal IDs for DB filtering
        dept_id = None
        if department_public_id:
            dept_id, err = _resolve_department_uuid(department_public_id, db)
            if err:
                return {"total": 0, "skip": skip, "limit": limit, "items": []}

        desig_id = None
        if designation_public_id:
            desig_id, err = _resolve_designation_uuid(designation_public_id, db)
            if err:
                return {"total": 0, "skip": skip, "limit": limit, "items": []}

        total, items = repo.search(
            db=db,
            first_name=first_name,
            last_name=last_name,
            dept_id=dept_id,
            designation_id=desig_id,
            employee_status=employee_status,
            employment_type=employment_type,
            gender=gender,
            min_joining_date=min_joining_date,
            max_joining_date=max_joining_date,
            skip=skip,
            limit=limit,
        )
        utils.log_action(
            "SEARCH",
            f"first_name={first_name!r} last_name={last_name!r} dept_uuid={department_public_id} "
            f"employee_status={employee_status!r} -> {total} match(es)",
        )
        return {"total": total, "skip": skip, "limit": limit, "items": items}

    # Fallback: in-memory filtering (no DB session)
    data = repo.get_all()
    results = []
    for emp in data:
        if first_name and first_name.strip().lower() not in emp.get("first_name", "").lower():
            continue
        if last_name and last_name.strip().lower() not in emp.get("last_name", "").lower():
            continue
        if department_public_id and emp.get("department_public_id") != department_public_id:
            continue
        if designation_public_id and emp.get("designation_public_id") != designation_public_id:
            continue
        if employee_status and emp.get("employee_status", "").lower() != employee_status.strip().lower():
            continue
        if employment_type and emp.get("employment_type", "").lower() != employment_type.strip().lower():
            continue
        if gender and emp.get("gender", "").lower() != gender.strip().lower():
            continue
        if min_joining_date and emp.get("joining_date", "") < min_joining_date:
            continue
        if max_joining_date and emp.get("joining_date", "") > max_joining_date:
            continue
        results.append(emp)

    total = len(results)
    paged = results[skip: skip + limit] if limit is not None else results[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": paged}


def get_record_by_id(e_id, db: Session | None = None):
    """Internal use only — looks up by integer emp_id."""
    e_id = int(e_id)
    return repo.get_by_id(e_id, db=db)


def get_record_by_public_id(public_id: str, db: Session):
    """Looks up an employee by their public UUID."""
    return repo.get_by_public_id(public_id, db=db)


def get_record_by_code(code, db=None):
    if utils.is_none(code):
        return None
    return repo.get_by_code(code, db=db)


def get_record_by_email(email, db=None):
    if utils.is_none(email):
        return None
    return repo.get_by_email(email, db=db)


def get_direct_reports(manager_public_id: str, db: Session):
    """Returns direct reports for a manager identified by public_id UUID."""
    manager, reports = repo.get_direct_reports(manager_public_id, db=db)
    if manager is None:
        return None
    return {
        "manager_public_id": str(manager.public_id),
        "count": len(reports),
        "reports": reports,
    }


def _validate_employee_payload(
    emp_data: EmployeeIn,
    current_emp_id: int | None = None,
    db: Session | None = None,
) -> dict | None:
    """Validates employee input against business rules and DB check constraints.
    Resolves UUID FK references to internal IDs for existence checks."""
    if utils.is_none(emp_data.first_name) or not emp_data.first_name.strip():
        return {"error": "validation", "message": "First name cannot be empty"}
    if utils.is_none(emp_data.last_name) or not emp_data.last_name.strip():
        return {"error": "validation", "message": "Last name cannot be empty"}

    # Date of birth checks
    if not utils.is_valid_date(emp_data.date_of_birth):
        return {"error": "validation", "message": "Invalid date_of_birth, expected format YYYY-MM-DD"}
    dob_d = datetime.date.fromisoformat(emp_data.date_of_birth.strip())
    if dob_d >= datetime.date.today():
        return {"error": "validation", "message": "Date of birth must be in the past"}

    # Joining date checks
    if not utils.is_valid_date(emp_data.joining_date):
        return {"error": "validation", "message": "Invalid joining_date, expected format YYYY-MM-DD"}
    join_d = datetime.date.fromisoformat(emp_data.joining_date.strip())

    # 18-year minimum age constraint
    min_joining_age = dob_d.replace(year=dob_d.year + 18)
    if join_d < min_joining_age:
        return {
            "error": "validation",
            "message": f"Employee must be at least 18 years old on joining date (DOB: {dob_d}, min joining: {min_joining_age})",
        }

    # Gender check
    gender_clean = emp_data.gender.strip().lower()
    if gender_clean not in VALID_GENDERS:
        return {"error": "validation", "message": f"Gender must be one of {sorted(VALID_GENDERS)}"}

    # Status check
    status_clean = emp_data.employee_status.strip().lower()
    if status_clean not in VALID_EMPLOYEE_STATUSES:
        return {"error": "validation", "message": f"Employee status must be one of {sorted(VALID_EMPLOYEE_STATUSES)}"}

    # Employment type check
    type_clean = emp_data.employment_type.strip().lower()
    if type_clean not in VALID_EMPLOYMENT_TYPES:
        return {"error": "validation", "message": f"Employment type must be one of {sorted(VALID_EMPLOYMENT_TYPES)}"}

    # Email check
    if not utils.is_valid_email(emp_data.email):
        return {"error": "validation", "message": "Invalid email address"}
    existing_by_email = repo.get_by_email(emp_data.email, db=db)
    if existing_by_email is not None:
        existing_id = (
            existing_by_email.emp_id
            if hasattr(existing_by_email, "emp_id")
            else existing_by_email.get("emp_id") or existing_by_email.get("id")
        )
        if existing_id != current_emp_id:
            return {"error": "validation", "message": f"Email '{emp_data.email}' is already in use"}

    # Phone check
    phone_clean = emp_data.phone.strip()
    if len(phone_clean) < 7 or len(phone_clean) > 15:
        return {"error": "validation", "message": "Phone number must be between 7 and 15 digits"}

    # Department UUID existence check
    if emp_data.department_public_id is not None and db is not None:
        _, err = _resolve_department_uuid(emp_data.department_public_id, db)
        if err:
            return {"error": "validation", "message": err}

    # Designation UUID existence check
    if emp_data.designation_public_id is not None and db is not None:
        _, err = _resolve_designation_uuid(emp_data.designation_public_id, db)
        if err:
            return {"error": "validation", "message": err}

    # Reporting manager UUID check
    if emp_data.reporting_manager_public_id is not None and db is not None:
        mgr_id, err = _resolve_manager_uuid(emp_data.reporting_manager_public_id, db)
        if err:
            return {"error": "validation", "message": err}
        if current_emp_id is not None and mgr_id == current_emp_id:
            return {"error": "validation", "message": "An employee cannot be their own reporting manager"}

    return None


def _resolve_fk_uuids(emp_data: EmployeeIn, db: Session) -> dict:
    """Resolves all FK UUID references in EmployeeIn to internal integer IDs.
    Returns dict with dept_id, designation_id, reporting_manager_id."""
    dept_id, _ = _resolve_department_uuid(emp_data.department_public_id, db)
    desig_id, _ = _resolve_designation_uuid(emp_data.designation_public_id, db)
    mgr_id, _ = _resolve_manager_uuid(emp_data.reporting_manager_public_id, db)
    return {
        "dept_id": dept_id,
        "designation_id": desig_id,
        "reporting_manager_id": mgr_id,
    }


def create_new_record(employee_in: EmployeeIn, db: Session | None = None):
    """Creates a new employee record. Resolves UUID FK references to internal IDs."""
    try:
        error = _validate_employee_payload(employee_in, None, db=db)
        if error:
            utils.log_action("CREATE_FAILED", error["message"])
            return {"ok": False, **error}

        if db is not None:
            fk_ids = _resolve_fk_uuids(employee_in, db)
            emp = repo.create_employee(
                db=db,
                first_name=employee_in.first_name,
                last_name=employee_in.last_name,
                date_of_birth=employee_in.date_of_birth,
                gender=employee_in.gender,
                email=employee_in.email,
                phone=employee_in.phone,
                joining_date=employee_in.joining_date,
                employee_status=employee_in.employee_status,
                employment_type=employee_in.employment_type,
                dept_id=fk_ids["dept_id"],
                designation_id=fk_ids["designation_id"],
                reporting_manager_id=fk_ids["reporting_manager_id"],
                is_active=employee_in.is_active,
                employee_code=employee_in.employee_code,
            )
            utils.log_action(
                "CREATE",
                f"emp_id={emp.emp_id} code={emp.employee_code} name={emp.first_name} {emp.last_name}",
            )
            return {"ok": True, "record": emp}

        return {"ok": False, "error": "server", "message": "Database session required"}

    except Exception as e:
        utils.log_action("CREATE_FAILED", f"unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def update_records(public_id: str, employee_in: EmployeeIn, db: Session):
    """Updates an existing employee record identified by public_id UUID."""
    try:
        emp = repo.get_by_public_id(public_id, db=db)
        if emp is None:
            msg = f"Employee with public_id '{public_id}' does not exist"
            utils.log_action("UPDATE_FAILED", msg)
            return {"ok": False, "error": "not_found", "message": msg}

        e_id = emp.emp_id

        error = _validate_employee_payload(employee_in, e_id, db=db)
        if error:
            utils.log_action("UPDATE_FAILED", f"public_id={public_id} {error['message']}")
            return {"ok": False, **error}

        fk_ids = _resolve_fk_uuids(employee_in, db)
        updated = repo.update_employee(
            db=db,
            e_id=e_id,
            first_name=employee_in.first_name,
            last_name=employee_in.last_name,
            date_of_birth=employee_in.date_of_birth,
            gender=employee_in.gender,
            email=employee_in.email,
            phone=employee_in.phone,
            joining_date=employee_in.joining_date,
            employee_status=employee_in.employee_status,
            employment_type=employee_in.employment_type,
            dept_id=fk_ids["dept_id"],
            designation_id=fk_ids["designation_id"],
            reporting_manager_id=fk_ids["reporting_manager_id"],
            is_active=employee_in.is_active,
            employee_code=employee_in.employee_code,
        )
        utils.log_action("UPDATE", f"public_id={public_id} updated in database")
        return {"ok": True, "record": updated}

    except Exception as e:
        utils.log_action("UPDATE_FAILED", f"public_id={public_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def delete_record(public_id: str, db: Session):
    """Deletes an employee identified by public_id UUID from the database."""
    try:
        emp = repo.get_by_public_id(public_id, db=db)
        if emp is None:
            utils.log_action("DELETE_FAILED", f"public_id={public_id} does not exist")
            return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{public_id}' not found"}

        repo.delete_employee(db=db, e_id=emp.emp_id)
        utils.log_action("DELETE", f"public_id={public_id} deleted from database")
        return {"ok": True, "details": f"Employee with public_id '{public_id}' deleted"}

    except Exception as e:
        utils.log_action("DELETE_FAILED", f"public_id={public_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


SORT_KEYS = {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Department": "dept_id",
    "Joining Date": "joining_date",
    "Status": "employee_status",
}


def get_record_choices(db=None):
    """Returns a list of (label, id) tuples for every employee."""
    employees = repo.get_all(db=db)
    return [
        (
            f"{e.get('emp_id') or e.get('id')} - {e.get('first_name')} {e.get('last_name')}",
            e.get("emp_id") or e.get("id"),
        )
        for e in employees
    ]


def sort_records(key="first_name", reverse=False, data=None):
    """Sort-key logic safely handles strings and numeric fields."""
    if data is None:
        data = repo.get_all()

    def sort_key(employee):
        if hasattr(employee, "to_dict"):
            employee = employee.to_dict()
        value = employee.get(key)
        if value is None:
            return "" if key in ("first_name", "last_name", "email", "employee_status", "joining_date", "date_of_birth", "phone") else float("-inf")
        if isinstance(value, str):
            return value.lower()
        return value

    sorted_data = sorted(data, key=sort_key, reverse=reverse)
    utils.log_action("SORT", f"key={key} reverse={reverse} -> {len(sorted_data)} record(s)")
    return sorted_data