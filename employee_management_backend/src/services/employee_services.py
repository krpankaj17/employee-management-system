# employee_services.py
import datetime
from typing import cast
import utils
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from core.cache import get_cached_or_compute, invalidate_cache
from repository import employee_repository as repo
from repository import department_repository as dept_repo
from repository import address_repo
from models.department import Department
from models.designation import Designation
from models.employee import Employee
from models.user import User
from schemas.employee_schema import EmployeeIn, EmployeeProfileIn, AdminEmployeeSetupIn

VALID_GENDERS = {"male", "female", "other", "prefer_not_to_say"}
VALID_EMPLOYEE_STATUSES = {"active", "inactive", "on_leave", "terminated", "resigned"}
VALID_EMPLOYMENT_TYPES = {"full_time", "part_time", "contract", "intern"}


def sync_employee_leave_statuses(db: Session) -> None:
    """
    Synchronizes employee_status with current active approved leaves.
    - If an employee has an approved leave spanning today (start_date <= today <= end_date),
      their employee_status in the DB is set to 'on_leave'.
    - If an employee is marked 'on_leave' but no longer has an approved leave spanning today,
      their employee_status reverts back to 'active'.
    """
    try:
        from models.leave import LeaveRequest
        from sqlalchemy import select, update, func
        import datetime

        today = datetime.date.today()
        # Find all employee IDs who currently have an active approved leave today
        active_leave_emp_ids = list(
            db.scalars(
                select(LeaveRequest.employee_id)
                .where(
                    func.lower(LeaveRequest.status) == "approved",
                    LeaveRequest.start_date <= today,
                    LeaveRequest.end_date >= today,
                )
            ).all()
        )

        updated = False
        if active_leave_emp_ids:
            # Mark them as 'on_leave' if currently 'active'
            res1 = db.execute(
                update(Employee)
                .where(
                    Employee.emp_id.in_(active_leave_emp_ids),
                    func.lower(Employee.employee_status) == "active",
                )
                .values(employee_status="on_leave")
            )
            if res1.rowcount and res1.rowcount > 0:
                updated = True

            # Revert any employee whose status is 'on_leave' but is NOT in active_leave_emp_ids
            res2 = db.execute(
                update(Employee)
                .where(
                    func.lower(Employee.employee_status) == "on_leave",
                    Employee.emp_id.not_in(active_leave_emp_ids),
                )
                .values(employee_status="active")
            )
            if res2.rowcount and res2.rowcount > 0:
                updated = True
        else:
            # No employees on leave today: revert any who might still be marked 'on_leave'
            res = db.execute(
                update(Employee)
                .where(func.lower(Employee.employee_status) == "on_leave")
                .values(employee_status="active")
            )
            if res.rowcount and res.rowcount > 0:
                updated = True

        if updated:
            db.commit()
            invalidate_cache("employee_lists")
            invalidate_cache("employee_profiles")
    except Exception as e:
        db.rollback()
        utils.log_action("LEAVE_STATUS_SYNC_FAILED", f"error={e}")


# ─── UUID → Internal ID Resolution ─────────────────────────────────────────────

def _resolve_department_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves department public_id UUID → internal dept_id.
    Returns (dept_id, error_message). error_message is None on success."""
    if not public_id:
        return None, None
    dept = db.scalar(select(Department).where(Department.public_id == public_id))
    if dept is None:
        return None, f"Department with public_id '{public_id}' does not exist"
    return cast(int, dept.dept_id), None


def _resolve_designation_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves designation public_id UUID → internal designation_id."""
    if not public_id:
        return None, None
    desig = db.scalar(select(Designation).where(Designation.public_id == public_id))
    if desig is None:
        return None, f"Designation with public_id '{public_id}' does not exist"
    return cast(int, desig.designation_id), None


def _resolve_manager_uuid(public_id: str | None, db: Session) -> tuple[int | None, str | None]:
    """Resolves reporting_manager public_id UUID → internal emp_id."""
    if not public_id:
        return None, None
    manager = repo.get_by_public_id(public_id, db=db)
    if manager is None:
        return None, f"Reporting manager with public_id '{public_id}' does not exist"
    return cast(int, manager.emp_id), None


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
    public_id=None,
    email=None,
    employee_code=None,
    reporting_manager_public_id=None,
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
        sync_employee_leave_statuses(db)
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

        mgr_id = None
        if reporting_manager_public_id:
            mgr_id, err = _resolve_manager_uuid(reporting_manager_public_id, db)
            if err:
                return {"total": 0, "skip": skip, "limit": limit, "items": []}

        total, items = repo.search(
            db=db,
            public_id=public_id,
            email=email,
            employee_code=employee_code,
            reporting_manager_id=mgr_id,
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
            f"public_id={public_id!r} email={email!r} emp_code={employee_code!r} "
            f"first_name={first_name!r} last_name={last_name!r} dept_uuid={department_public_id} "
            f"employee_status={employee_status!r} -> {total} match(es)",
        )
        return {"total": total, "skip": skip, "limit": limit, "items": items}

    # Fallback: in-memory filtering (no DB session)
    data = repo.get_all()
    results = []
    for emp in data:
        if public_id and emp.get("public_id") != public_id:
            continue
        if email and emp.get("email", "").lower() != email.strip().lower():
            continue
        if employee_code and emp.get("employee_code", "").lower() != employee_code.strip().lower():
            continue
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
    if db is not None:
        sync_employee_leave_statuses(db)
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

    is_update = current_emp_id is not None

    # Date of birth checks
    dob_raw = emp_data.date_of_birth
    dob_d: datetime.date | None = None
    if dob_raw and dob_raw.strip():
        if not utils.is_valid_date(dob_raw):
            return {"error": "validation", "message": "Invalid date_of_birth, expected format YYYY-MM-DD"}
        dob_d = datetime.date.fromisoformat(dob_raw.strip())
        if dob_d >= datetime.date.today():
            return {"error": "validation", "message": "Date of birth must be in the past"}
    elif not is_update:
        # date_of_birth is required when creating a new employee
        return {"error": "validation", "message": "Invalid date_of_birth, expected format YYYY-MM-DD"}

    # Joining date checks
    join_raw = emp_data.joining_date
    join_d: datetime.date | None = None
    if join_raw and join_raw.strip():
        if not utils.is_valid_date(join_raw):
            return {"error": "validation", "message": "Invalid joining_date, expected format YYYY-MM-DD"}
        join_d = datetime.date.fromisoformat(join_raw.strip())
    elif not is_update:
        # joining_date is required when creating a new employee
        return {"error": "validation", "message": "Invalid joining_date, expected format YYYY-MM-DD"}

    # 18-year minimum age constraint (only when both dates are provided)
    if dob_d is not None and join_d is not None:
        min_joining_age = dob_d.replace(year=dob_d.year + 18)
        if join_d < min_joining_age:
            return {
                "error": "validation",
                "message": f"Employee must be at least 18 years old on joining date (DOB: {dob_d}, min joining: {min_joining_age})",
            }

    # Gender check
    gender_raw = emp_data.gender
    if not gender_raw or not gender_raw.strip():
        return {"error": "validation", "message": f"Gender must be one of {sorted(VALID_GENDERS)}"}
    gender_clean = gender_raw.strip().lower()
    if gender_clean not in VALID_GENDERS:
        return {"error": "validation", "message": f"Gender must be one of {sorted(VALID_GENDERS)}"}

    # Status check
    status_raw = emp_data.employee_status
    if not status_raw or not status_raw.strip():
        return {"error": "validation", "message": f"Employee status must be one of {sorted(VALID_EMPLOYEE_STATUSES)}"}
    status_clean = status_raw.strip().lower()
    if status_clean not in VALID_EMPLOYEE_STATUSES:
        return {"error": "validation", "message": f"Employee status must be one of {sorted(VALID_EMPLOYEE_STATUSES)}"}

    # Employment type check
    type_raw = emp_data.employment_type
    if not type_raw or not type_raw.strip():
        return {"error": "validation", "message": f"Employment type must be one of {sorted(VALID_EMPLOYMENT_TYPES)}"}
    type_clean = type_raw.strip().lower()
    if type_clean not in VALID_EMPLOYMENT_TYPES:
        return {"error": "validation", "message": f"Employment type must be one of {sorted(VALID_EMPLOYMENT_TYPES)}"}

    # Email check
    if emp_data.email is not None and emp_data.email.strip():
        if not utils.is_valid_email(emp_data.email):
            return {"error": "validation", "message": "Invalid email address"}
        existing_by_email = repo.get_by_email(emp_data.email.strip().lower(), db=db)
        if existing_by_email is not None:
            existing_id = (
                existing_by_email.emp_id
                if hasattr(existing_by_email, "emp_id")
                else existing_by_email.get("emp_id") or existing_by_email.get("id")
            )
            if existing_id != current_emp_id:
                return {"error": "validation", "message": f"Email '{emp_data.email}' is already in use"}
    elif current_emp_id is None:
        return {"error": "validation", "message": "Email is required"}

    # Phone check
    if emp_data.phone is not None and emp_data.phone.strip():
        phone_clean = emp_data.phone.strip()
        if len(phone_clean) < 7 or len(phone_clean) > 15:
            return {"error": "validation", "message": "Phone number must be between 7 and 15 digits"}
    elif current_emp_id is None:
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
            invalidate_cache("employee_lists")
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

        e_id = cast(int, emp.emp_id)

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
            email=employee_in.email.strip().lower() if (employee_in.email and employee_in.email.strip()) else cast(str, emp.email),
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
        invalidate_cache("employee_profiles", public_id)
        invalidate_cache("employee_lists")
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

        repo.delete_employee(db=db, e_id=cast(int, emp.emp_id))
        invalidate_cache("employee_profiles", public_id)
        invalidate_cache("employee_lists")
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


# ─── Self-Service Onboarding & Full Profile Operations ─────────────────────────

def get_my_full_profile(current_user, db: Session) -> dict | None:
    """Retrieves full profile with addresses and emergency contacts for the logged in user."""
    if not current_user.employee:
        return None

    return get_employee_full_details(str(current_user.employee.public_id), db=db)


def get_employee_full_details(public_id: str, db: Session) -> dict | None:
    """Retrieves full profile for an employee by public UUID, including addresses and emergency contacts."""
    if db is not None:
        sync_employee_leave_statuses(db)

    def _fetch():
        emp = repo.get_by_public_id(public_id, db=db)
        if not emp:
            return None

        emp_internal_id = cast(int, emp.emp_id)
        emp_dict = emp.to_dict()
        emp_dict["secondary_email"] = emp.user.secondary_email if isinstance(emp.user, User) else None
        emp_dict["addresses"] = address_repo.get_employee_addresses(emp_internal_id, db=db)
        contacts = address_repo.get_emergency_contacts(emp_internal_id, db=db)
        emp_dict["emergency_contacts"] = [c.to_dict() for c in contacts]
        return emp_dict

    return get_cached_or_compute("employee_profiles", public_id, _fetch)


def admin_setup_employee(public_id: str, payload: AdminEmployeeSetupIn, db: Session) -> dict:
    """Configures corporate information, bank details, salary, and optional personal data in a single atomic transaction."""
    try:
        emp = repo.get_by_public_id(public_id, db=db)
        if emp is None:
            return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{public_id}' not found"}

        emp_internal_id = cast(int, emp.emp_id)

        # 1. Resolve Corporate FK references
        if payload.department_public_id is not None:
            dept_id, err = _resolve_department_uuid(payload.department_public_id, db)
            if err:
                return {"ok": False, "error": "validation", "message": err}
            emp.dept_id = dept_id

        if payload.designation_public_id is not None:
            desig_id, err = _resolve_designation_uuid(payload.designation_public_id, db)
            if err:
                return {"ok": False, "error": "validation", "message": err}
            emp.designation_id = desig_id

        if payload.reporting_manager_public_id is not None:
            mgr_id, err = _resolve_manager_uuid(payload.reporting_manager_public_id, db)
            if err:
                return {"ok": False, "error": "validation", "message": err}
            if mgr_id == emp_internal_id:
                return {"ok": False, "error": "validation", "message": "An employee cannot be their own reporting manager"}
            emp.reporting_manager_id = mgr_id

        # 2. Corporate fields
        if payload.joining_date:
            if not utils.is_valid_date(payload.joining_date):
                return {"ok": False, "error": "validation", "message": "Invalid joining_date format YYYY-MM-DD"}
            emp.joining_date = datetime.date.fromisoformat(payload.joining_date.strip())

        if payload.employee_status:
            stat = payload.employee_status.strip().lower()
            if stat not in VALID_EMPLOYEE_STATUSES:
                return {"ok": False, "error": "validation", "message": f"Employee status must be one of {sorted(VALID_EMPLOYEE_STATUSES)}"}
            emp.employee_status = stat

        if payload.employment_type:
            etype = payload.employment_type.strip().lower()
            if etype not in VALID_EMPLOYMENT_TYPES:
                return {"ok": False, "error": "validation", "message": f"Employment type must be one of {sorted(VALID_EMPLOYMENT_TYPES)}"}
            emp.employment_type = etype

        if payload.employee_code:
            code_clean = payload.employee_code.strip()
            existing_code = repo.get_by_code(code_clean, db=db)
            if existing_code and existing_code.emp_id != emp.emp_id:
                return {"ok": False, "error": "validation", "message": f"Employee code '{code_clean}' is already in use"}
            emp.employee_code = code_clean

        if payload.is_active is not None:
            emp.is_active = payload.is_active

        # 3. Optional Personal fields
        if payload.first_name:
            emp.first_name = payload.first_name.strip()
        if payload.last_name:
            emp.last_name = payload.last_name.strip()
        if payload.gender:
            g = payload.gender.strip().lower()
            if g not in VALID_GENDERS:
                return {"ok": False, "error": "validation", "message": f"Gender must be one of {sorted(VALID_GENDERS)}"}
            emp.gender = g
        if payload.phone:
            p = payload.phone.strip()
            if len(p) < 7 or len(p) > 15:
                return {"ok": False, "error": "validation", "message": "Phone number must be between 7 and 15 digits"}
            existing_p = repo.get_by_phone(p, db=db)
            if existing_p and existing_p.emp_id != emp.emp_id:
                return {"ok": False, "error": "validation", "message": f"Phone number '{p}' is already in use"}
            emp.phone = p
        if payload.date_of_birth:
            if not utils.is_valid_date(payload.date_of_birth):
                return {"ok": False, "error": "validation", "message": "Invalid date_of_birth format YYYY-MM-DD"}
            dob_d = datetime.date.fromisoformat(payload.date_of_birth.strip())
            if dob_d >= datetime.date.today():
                return {"ok": False, "error": "validation", "message": "Date of birth must be in the past"}
            emp.date_of_birth = dob_d

        emp_user = emp.user
        if isinstance(emp_user, User):
            if payload.secondary_email:
                sec_clean = payload.secondary_email.strip().lower()
                if not utils.is_valid_email(sec_clean):
                    return {"ok": False, "error": "validation", "message": "Invalid secondary_email format"}
                emp_user.secondary_email = sec_clean

            if payload.first_name or payload.last_name:
                emp_user.display_name = f"{emp.first_name} {emp.last_name}".strip()

        # 4. Optional Bank Details
        if payload.bank_name and payload.account_number and payload.routing_code:
            from repository import payroll_repo
            from models.payroll import BankDetail
            payroll_repo.clear_primary_bank_details(emp_internal_id, db=db)
            bank_rec = BankDetail(
                emp_id=emp_internal_id,
                bank_name=payload.bank_name.strip(),
                branch_name=payload.branch_name.strip() if payload.branch_name else None,
                account_number=payload.account_number.strip(),
                routing_code=payload.routing_code.strip(),
                account_type=payload.account_type.strip().lower() if payload.account_type else "savings",
                is_primary=True,
            )
            payroll_repo.create_bank_detail(bank_rec, db=db)

        # 5. Optional Salary Details
        if payload.basic_salary is not None and payload.basic_salary >= 0:
            from repository import payroll_repo
            from models.payroll import Salary
            from decimal import Decimal
            basic_dec = Decimal(str(payload.basic_salary))
            net_dec = Decimal(str(payload.net_salary)) if payload.net_salary is not None else basic_dec
            joining_date: datetime.date | None = emp.joining_date  # type: ignore[assignment]
            eff_from: datetime.date = joining_date if joining_date is not None else datetime.date.today()
            payroll_repo.close_previous_salary(emp_internal_id, eff_from, db=db)
            salary_rec = Salary(
                emp_id=emp_internal_id,
                basic_salary=basic_dec,
                net_salary=net_dec,
                currency=payload.currency or "INR",
                effective_from=eff_from,
            )
            payroll_repo.create_salary(salary_rec, components=[], db=db)

        # 6. Addresses
        for addr_in in payload.addresses:
            addr_type = addr_in.address_type.strip().lower()
            if addr_type not in {"current", "permanent"}:
                continue
            address_repo.add_employee_address(
                emp_id=emp_internal_id,
                street_address=addr_in.street_address,
                city=addr_in.city,
                state=addr_in.state,
                country=addr_in.country,
                pincode=addr_in.pincode,
                address_type=addr_type,
                is_primary=addr_in.is_primary,
                db=db,
            )

        # 7. Emergency Contacts
        for ec_in in payload.emergency_contacts:
            address_repo.add_emergency_contact(
                emp_id=emp_internal_id,
                contact_name=ec_in.contact_name,
                relationship=ec_in.relationship,
                phone=ec_in.phone,
                email=ec_in.email,
                is_primary=ec_in.is_primary,
                db=db,
            )

        db.commit()
        db.refresh(emp)

        invalidate_cache("employee_profiles", public_id)
        invalidate_cache("employee_lists")
        full_profile = get_employee_full_details(str(emp.public_id), db=db)
        utils.log_action("ADMIN_SETUP_COMPLETED", f"emp_code={emp.employee_code} public_id={emp.public_id}")
        return {"ok": True, "employee": full_profile}
    except Exception as e:
        db.rollback()
        utils.log_action("ADMIN_SETUP_FAILED", f"public_id={public_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def onboard_or_update_my_profile(current_user, payload: EmployeeProfileIn, db: Session) -> dict:
    """Updates or creates employee personal profile with addresses & emergency contacts in a single atomic transaction."""
    try:
        # 1. Validation
        dob_d = None
        if payload.date_of_birth:
            if not utils.is_valid_date(payload.date_of_birth):
                return {"ok": False, "error": "validation", "message": "Invalid date_of_birth, expected format YYYY-MM-DD"}
            dob_d = datetime.date.fromisoformat(payload.date_of_birth.strip())
            if dob_d >= datetime.date.today():
                return {"ok": False, "error": "validation", "message": "Date of birth must be in the past"}
            today = datetime.date.today()
            if today < dob_d.replace(year=dob_d.year + 18):
                return {"ok": False, "error": "validation", "message": "Employee must be at least 18 years old"}

        gender_clean = None
        if payload.gender:
            gender_clean = payload.gender.strip().lower()
            if gender_clean not in VALID_GENDERS:
                return {"ok": False, "error": "validation", "message": f"Gender must be one of {sorted(VALID_GENDERS)}"}

        phone_clean = None
        if payload.phone:
            phone_clean = payload.phone.strip()
            if len(phone_clean) < 7 or len(phone_clean) > 15:
                return {"ok": False, "error": "validation", "message": "Phone number must be between 7 and 15 digits"}

            existing_by_phone = repo.get_by_phone(phone_clean, db=db)
            if existing_by_phone and (not current_user.employee or existing_by_phone.emp_id != current_user.employee.emp_id):
                return {"ok": False, "error": "validation", "message": f"Phone number '{phone_clean}' is already in use"}

        if payload.secondary_email:
            sec_clean = payload.secondary_email.strip().lower()
            if not utils.is_valid_email(sec_clean):
                return {"ok": False, "error": "validation", "message": "Invalid secondary_email format"}
            current_user.secondary_email = sec_clean

        # 2. Get or create Employee record
        emp = None
        if current_user.employee:
            emp = repo.get_by_id(cast(int, current_user.employee.emp_id), db=db)

        if emp is None:
            max_id = db.scalar(select(func.max(Employee.emp_id))) or 0
            code = f"EMP-{1000 + max_id + 1}"
            first_name = payload.first_name.strip() if payload.first_name else current_user.display_name
            last_name = payload.last_name.strip() if payload.last_name else ""
            emp = Employee(
                user_id=current_user.user_id,
                employee_code=code,
                first_name=first_name,
                last_name=last_name,
                date_of_birth=dob_d,
                gender=gender_clean or "male",
                email=current_user.email,
                phone=phone_clean,
                joining_date=datetime.date.today(),
                employee_status="active",
                employment_type="full_time",
                is_active=True,
            )
            db.add(emp)
            db.flush()
        else:
            if payload.first_name:
                emp.first_name = payload.first_name.strip()
            if payload.last_name:
                emp.last_name = payload.last_name.strip()
            if dob_d:
                emp.date_of_birth = dob_d
            if gender_clean:
                emp.gender = gender_clean
            if phone_clean:
                emp.phone = phone_clean
            db.flush()

        current_user.display_name = f"{emp.first_name} {emp.last_name}".strip()

        emp_internal_id = cast(int, emp.emp_id)

        # 3. Process addresses if provided
        for addr_in in payload.addresses:
            addr_type = addr_in.address_type.strip().lower()
            if addr_type not in {"current", "permanent"}:
                continue
            address_repo.add_employee_address(
                emp_id=emp_internal_id,
                street_address=addr_in.street_address,
                city=addr_in.city,
                state=addr_in.state,
                country=addr_in.country,
                pincode=addr_in.pincode,
                address_type=addr_type,
                is_primary=addr_in.is_primary,
                db=db,
            )

        # 4. Process emergency contacts if provided
        for ec_in in payload.emergency_contacts:
            address_repo.add_emergency_contact(
                emp_id=emp_internal_id,
                contact_name=ec_in.contact_name,
                relationship=ec_in.relationship,
                phone=ec_in.phone,
                email=ec_in.email,
                is_primary=ec_in.is_primary,
                db=db,
            )

        db.commit()
        db.refresh(emp)
        db.refresh(current_user)

        if emp:
            invalidate_cache("employee_profiles", str(emp.public_id))
        invalidate_cache("employee_lists")

        full_profile = get_my_full_profile(current_user, db=db)
        utils.log_action("ONBOARD_PROFILE_SAVED", f"user={current_user.email} emp_code={emp.employee_code}")
        return {"ok": True, "profile": full_profile}
    except Exception as e:
        db.rollback()
        utils.log_action("ONBOARD_PROFILE_FAILED", f"user={current_user.email} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}