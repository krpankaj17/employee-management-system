# attendance_services.py
import datetime
import calendar
import utils
from repository import attendance_repository as repo
from repository import employee_repository as emp_repo

VALID_WORK_MODES = {"in_office", "remote", "field"}
VALID_STATUSES = {"present", "half_day", "absent", "on_leave"}
TIME_FORMATS = ["%H:%M:%S", "%H:%M"]

# Standard shift start time (09:00 AM) and grace threshold (09:15 AM)
STANDARD_SHIFT_START = datetime.time(9, 0, 0)
GRACE_SHIFT_THRESHOLD = datetime.time(9, 15, 0)


def _get_emp_field(emp, field_name, default=None):
    """Safely retrieves a field from an Employee ORM model or dictionary."""
    if emp is None:
        return default
    if hasattr(emp, field_name):
        val = getattr(emp, field_name)
        return val if val is not None else default
    if isinstance(emp, dict):
        return emp.get(field_name, default)
    return default


def _parse_time_str(time_str):
    """Parses a time string in %H:%M:%S or %H:%M format into a datetime.time object."""
    if not time_str or not isinstance(time_str, str):
        return None
    time_str = time_str.strip()
    for fmt in TIME_FORMATS:
        try:
            return datetime.datetime.strptime(time_str, fmt).time()
        except ValueError:
            pass
    return None


def _is_future_date(date_str):
    """Returns True if date_str represents a calendar date in the future."""
    if not date_str or not isinstance(date_str, str):
        return False
    try:
        parsed = datetime.datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        return parsed > datetime.date.today()
    except ValueError:
        return False


def _is_future_time_on_date(date_str, time_str):
    """Returns True if the time on the given date lies in the future."""
    if _is_future_date(date_str):
        return True
    try:
        parsed_date = datetime.datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
        if parsed_date == datetime.date.today():
            t = _parse_time_str(time_str)
            if t and t > datetime.datetime.now().time():
                return True
    except (ValueError, TypeError):
        pass
    return False


def _calculate_hours(check_in_str, check_out_str):
    """Calculates total hours worked between check_in and check_out strings.
    Returns float rounded to 2 decimal places."""
    t_in = _parse_time_str(check_in_str)
    t_out = _parse_time_str(check_out_str)
    if not t_in or not t_out:
        return 0.0
    dt_in = datetime.datetime.combine(datetime.date.min, t_in)
    dt_out = datetime.datetime.combine(datetime.date.min, t_out)
    if dt_out <= dt_in:
        return 0.0
    diff = dt_out - dt_in
    return round(diff.total_seconds() / 3600.0, 2)


def _check_late_arrival(check_in_time):
    """Determines whether check_in_time is late past 09:15 AM threshold.
    Returns (is_late: bool, late_minutes: int)."""
    if check_in_time > GRACE_SHIFT_THRESHOLD:
        dt_start = datetime.datetime.combine(datetime.date.min, STANDARD_SHIFT_START)
        dt_in = datetime.datetime.combine(datetime.date.min, check_in_time)
        late_mins = int((dt_in - dt_start).total_seconds() // 60)
        return True, late_mins
    return False, 0


def _determine_status(total_hours):
    """Determines attendance status based on standard working hours."""
    if total_hours >= 8.0:
        return "present"
    elif total_hours >= 4.0:
        return "half_day"
    else:
        return "absent"


# ─── Core Live Punch Operations (Server-Authoritative) ─────────────────────────

def check_in_employee(employee_id, work_mode="in_office", notes=None):
    """Records an employee live check-in using the current server timestamp.
    Client CANNOT pass date or time - server authority strictly enforced."""
    try:
        employee_id = int(employee_id)
        employee = emp_repo.get_by_id(employee_id)
        if employee is None:
            return {"ok": False, "error": "not_found", "message": f"Employee with id {employee_id} not found"}

        emp_status = _get_emp_field(employee, "employee_status")
        if emp_status in ("terminated", "inactive"):
            return {
                "ok": False,
                "error": "validation",
                "message": f"Cannot check in: Employee {employee_id} status is '{emp_status}'",
            }

        work_mode = work_mode.strip().lower() if work_mode else "in_office"
        if work_mode not in VALID_WORK_MODES:
            return {"ok": False, "error": "validation", "message": f"work_mode must be one of {sorted(VALID_WORK_MODES)}"}

        now = datetime.datetime.now()
        today_str = now.date().isoformat()
        now_time_str = now.strftime("%H:%M:%S")

        # Prevent duplicate open check-in on the same day
        open_record = repo.get_open_check_in(employee_id, today_str)
        if open_record is not None:
            return {
                "ok": False,
                "error": "conflict",
                "message": f"Employee {employee_id} already has an active check-in at {open_record.get('check_in')} for today ({today_str})",
            }

        is_late, late_minutes = _check_late_arrival(now.time())
        auto_notes = notes.strip() if notes else ""
        if is_late:
            late_tag = f"[Late Arrival: {late_minutes} mins past 09:00]"
            auto_notes = f"{late_tag} {auto_notes}".strip()

        new_record = {
            "employee_id": employee_id,
            "date": today_str,
            "check_in": now_time_str,
            "check_out": None,
            "work_mode": work_mode,
            "status": "present",
            "total_hours": 0.0,
            "is_late": is_late,
            "late_minutes": late_minutes,
            "notes": auto_notes if auto_notes else None,
        }

        created = repo.create(new_record)
        utils.log_action(
            "ATTENDANCE_CHECK_IN",
            f"emp_id={employee_id} date={today_str} in={now_time_str} mode={work_mode} is_late={is_late}",
        )
        return {"ok": True, "record": created}
    except Exception as e:
        utils.log_action("ATTENDANCE_CHECK_IN_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def check_out_employee(employee_id, notes=None):
    """Records an employee live check-out using the current server timestamp.
    Client CANNOT pass date or time - server authority strictly enforced."""
    try:
        employee_id = int(employee_id)
        if emp_repo.get_by_id(employee_id) is None:
            return {"ok": False, "error": "not_found", "message": f"Employee with id {employee_id} not found"}

        now = datetime.datetime.now()
        today_str = now.date().isoformat()
        now_time_str = now.strftime("%H:%M:%S")

        open_record = repo.get_open_check_in(employee_id, today_str)
        if open_record is None:
            return {
                "ok": False,
                "error": "not_found",
                "message": f"No open check-in record found for employee {employee_id} on today ({today_str})",
            }

        total_hours = _calculate_hours(open_record["check_in"], now_time_str)
        status = _determine_status(total_hours)

        updated_fields = {
            "check_out": now_time_str,
            "total_hours": total_hours,
            "status": status,
        }
        if notes:
            existing_notes = open_record.get("notes")
            updated_fields["notes"] = f"{existing_notes} | {notes.strip()}" if existing_notes else notes.strip()

        updated_record = repo.update(open_record["id"], updated_fields)

        utils.log_action(
            "ATTENDANCE_CHECK_OUT",
            f"emp_id={employee_id} date={today_str} out={now_time_str} total_hours={total_hours} status={status}",
        )
        return {"ok": True, "record": updated_record}
    except Exception as e:
        utils.log_action("ATTENDANCE_CHECK_OUT_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def create_manual_record(employee_id, date_str, check_in=None, check_out=None,
                         work_mode="in_office", status="present", notes=None):
    """Allows manual creation of attendance by Administrators / HR (e.g. past dates, leaves, administrative overrides)."""
    try:
        employee_id = int(employee_id)
        if emp_repo.get_by_id(employee_id) is None:
            return {"ok": False, "error": "not_found", "message": f"Employee with id {employee_id} not found"}

        if not utils.is_valid_date(date_str):
            return {"ok": False, "error": "validation", "message": "Invalid date format, expected YYYY-MM-DD"}

        status = (status or "present").strip().lower()
        if status not in VALID_STATUSES:
            return {"ok": False, "error": "validation", "message": f"status must be one of {sorted(VALID_STATUSES)}"}

        work_mode = (work_mode or "in_office").strip().lower()
        if work_mode not in VALID_WORK_MODES:
            return {"ok": False, "error": "validation", "message": f"work_mode must be one of {sorted(VALID_WORK_MODES)}"}

        # Strict business rule for future dates
        if _is_future_date(date_str):
            if status != "on_leave":
                return {
                    "ok": False,
                    "error": "validation",
                    "message": "Cannot create attendance for future dates unless status is 'on_leave'",
                }
            if check_in or check_out:
                return {
                    "ok": False,
                    "error": "validation",
                    "message": "Future leave records must not have check-in or check-out times",
                }

        # Check existing record for this employee and date
        existing = repo.get_by_employee_and_date(employee_id, date_str)
        if existing:
            first_rec = existing[0] if isinstance(existing, list) else existing
            return {
                "ok": False,
                "error": "conflict",
                "message": f"Attendance record already exists for employee {employee_id} on {date_str} (id={first_rec['id']})",
            }

        # Validate punch timestamps if provided
        t_in = _parse_time_str(check_in) if check_in else None
        t_out = _parse_time_str(check_out) if check_out else None

        if check_in and t_in is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_in time format. Use HH:MM:SS or HH:MM"}
        if check_out and t_out is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_out time format. Use HH:MM:SS or HH:MM"}

        if t_in and t_out and t_out <= t_in:
            return {"ok": False, "error": "validation", "message": "check_out time must be after check_in time"}

        if check_in and _is_future_time_on_date(date_str, check_in):
            return {"ok": False, "error": "validation", "message": "check_in time cannot be in the future"}
        if check_out and _is_future_time_on_date(date_str, check_out):
            return {"ok": False, "error": "validation", "message": "check_out time cannot be in the future"}

        # Calculate hours and late metrics
        total_hours = _calculate_hours(check_in, check_out) if (check_in and check_out) else 0.0
        is_late = False
        late_minutes = 0
        if t_in:
            is_late, late_minutes = _check_late_arrival(t_in)

        new_record = {
            "employee_id": employee_id,
            "date": date_str,
            "check_in": t_in.strftime("%H:%M:%S") if t_in else None,
            "check_out": t_out.strftime("%H:%M:%S") if t_out else None,
            "work_mode": work_mode,
            "status": status,
            "total_hours": total_hours,
            "is_late": is_late,
            "late_minutes": late_minutes,
            "notes": notes.strip() if notes else None,
        }

        created = repo.create(new_record)
        utils.log_action(
            "ATTENDANCE_MANUAL_CREATE",
            f"emp_id={employee_id} date={date_str} in={check_in} out={check_out} status={status}",
        )
        return {"ok": True, "record": created}
    except Exception as e:
        utils.log_action("ATTENDANCE_MANUAL_CREATE_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


create_manual_attendance = create_manual_record


def update_attendance_record(a_id, check_in=None, check_out=None, work_mode=None, status=None, notes=None):
    """Updates an existing attendance record (admin override). Recalculates total_hours & is_late automatically."""
    try:
        a_id = utils.convert_string_to_integer(a_id) if isinstance(a_id, str) else a_id
        existing = repo.get_by_id(a_id)
        if existing is None:
            return {"ok": False, "error": "not_found", "message": f"Attendance record {a_id} not found"}

        effective_date = existing["date"]
        effective_in = check_in.strip() if check_in is not None else existing.get("check_in")
        effective_out = check_out.strip() if check_out is not None else existing.get("check_out")
        effective_status = status.strip().lower() if status is not None else existing.get("status")
        effective_mode = work_mode.strip().lower() if work_mode is not None else existing.get("work_mode")

        if effective_status not in VALID_STATUSES:
            return {"ok": False, "error": "validation", "message": f"status must be one of {sorted(VALID_STATUSES)}"}
        if effective_mode not in VALID_WORK_MODES:
            return {"ok": False, "error": "validation", "message": f"work_mode must be one of {sorted(VALID_WORK_MODES)}"}

        t_in = _parse_time_str(effective_in) if effective_in else None
        t_out = _parse_time_str(effective_out) if effective_out else None

        if effective_in and t_in is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_in format"}
        if effective_out and t_out is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_out format"}
        if t_in and t_out and t_out <= t_in:
            return {"ok": False, "error": "validation", "message": "check_out time must be after check_in time"}

        if effective_in and _is_future_time_on_date(effective_date, effective_in):
            return {"ok": False, "error": "validation", "message": "check_in time cannot be in the future"}
        if effective_out and _is_future_time_on_date(effective_date, effective_out):
            return {"ok": False, "error": "validation", "message": "check_out time cannot be in the future"}

        total_hours = _calculate_hours(effective_in, effective_out) if (effective_in and effective_out) else 0.0
        is_late, late_minutes = (False, 0)
        if t_in:
            is_late, late_minutes = _check_late_arrival(t_in)

        updates = {
            "check_in": t_in.strftime("%H:%M:%S") if t_in else None,
            "check_out": t_out.strftime("%H:%M:%S") if t_out else None,
            "work_mode": effective_mode,
            "status": effective_status,
            "total_hours": total_hours,
            "is_late": is_late,
            "late_minutes": late_minutes,
        }
        if notes is not None:
            updates["notes"] = notes.strip() if notes else None

        updated_record = repo.update(a_id, updates)
        utils.log_action("ATTENDANCE_UPDATE", f"id={a_id} updates={updates}")
        return {"ok": True, "record": updated_record}
    except Exception as e:
        utils.log_action("ATTENDANCE_UPDATE_FAILED", f"id={a_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


update_record = update_attendance_record


def delete_attendance_record(a_id):
    """Deletes an attendance record by ID."""
    try:
        a_id = utils.convert_string_to_integer(a_id) if isinstance(a_id, str) else a_id
        if repo.get_by_id(a_id) is None:
            return {"ok": False, "error": "not_found", "message": f"Attendance record with id {a_id} not found"}
        repo.delete(a_id)
        utils.log_action("ATTENDANCE_DELETE", f"id={a_id}")
        return {"ok": True, "details": f"Attendance record {a_id} deleted successfully"}
    except Exception as e:
        utils.log_action("ATTENDANCE_DELETE_FAILED", f"id={a_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


delete_record = delete_attendance_record


# ─── Query & Summary Aggregates ────────────────────────────────────────────────

def get_all_records(employee_id=None, department_id=None, date_from=None, date_to=None,
                    status=None, work_mode=None, skip=0, limit=None):
    """Retrieves paginated and filtered attendance records across the enterprise."""
    data = repo.get_all()

    # Join department if department_id filter is requested
    if department_id is not None:
        department_id = utils.convert_string_to_integer(department_id) if isinstance(department_id, str) else department_id
        dept_emp_ids = {
            _get_emp_field(e, "emp_id", e.get("id") if isinstance(e, dict) else None)
            for e in emp_repo.get_all()
            if _get_emp_field(e, "dept_id") == department_id
        }
        data = [r for r in data if r.get("employee_id") in dept_emp_ids]

    if employee_id is not None:
        employee_id = utils.convert_string_to_integer(employee_id) if isinstance(employee_id, str) else employee_id
        data = [r for r in data if r.get("employee_id") == employee_id]

    if date_from:
        data = [r for r in data if r.get("date", "") >= date_from]
    if date_to:
        data = [r for r in data if r.get("date", "") <= date_to]
    if status:
        data = [r for r in data if r.get("status") == status.strip().lower()]
    if work_mode:
        data = [r for r in data if r.get("work_mode") == work_mode.strip().lower()]

    data.sort(key=lambda x: (x.get("date", ""), x.get("id", 0)), reverse=True)
    total = len(data)
    items = data[skip: skip + limit] if limit is not None else data[skip:]
    return {"total": total, "skip": skip, "limit": limit, "items": items}


get_all_attendance = get_all_records


def get_attendance_by_id(a_id):
    """Retrieves a single attendance record by ID."""
    a_id = utils.convert_string_to_integer(a_id) if isinstance(a_id, str) else a_id
    return repo.get_by_id(a_id)


get_record_by_id = get_attendance_by_id


def get_employee_attendance(employee_id, date_from=None, date_to=None,
                            status=None, skip=0, limit=None):
    """Retrieves attendance history for a specific employee with optional date range/status filters."""
    employee_id = int(employee_id)
    if emp_repo.get_by_id(employee_id) is None:
        return None

    return get_all_records(
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        skip=skip,
        limit=limit,
    )


def get_monthly_summary(employee_id, year, month):
    """Generates monthly attendance aggregates and daily breakdown for an employee."""
    employee_id = int(employee_id)
    employee = emp_repo.get_by_id(employee_id)
    if employee is None:
        return None

    first_name = _get_emp_field(employee, "first_name", "")
    last_name = _get_emp_field(employee, "last_name", "")
    emp_name = f"{first_name} {last_name}".strip()

    prefix = f"{year:04d}-{month:02d}"
    records = [
        r for r in repo.get_by_employee_id(employee_id)
        if r.get("date", "").startswith(prefix)
    ]
    records.sort(key=lambda x: x.get("date", ""))

    days_present = sum(1 for r in records if r.get("status") == "present")
    days_half_day = sum(1 for r in records if r.get("status") == "half_day")
    days_on_leave = sum(1 for r in records if r.get("status") == "on_leave")
    days_absent = sum(1 for r in records if r.get("status") == "absent")
    total_hours_worked = round(sum(r.get("total_hours", 0.0) for r in records), 2)

    working_days_logged = days_present + days_half_day
    avg_daily_hours = (
        round(total_hours_worked / working_days_logged, 2)
        if working_days_logged > 0
        else 0.0
    )

    _, days_in_month = calendar.monthrange(year, month)

    return {
        "employee_id": employee_id,
        "employee_name": emp_name,
        "year": year,
        "month": month,
        "month_name": calendar.month_name[month],
        "days_in_month": days_in_month,
        "total_days_logged": len(records),
        "days_present": days_present,
        "days_half_day": days_half_day,
        "days_on_leave": days_on_leave,
        "days_absent": days_absent,
        "total_hours_worked": total_hours_worked,
        "avg_daily_hours": avg_daily_hours,
        "records": records,
    }


get_employee_monthly_attendance_summary = get_monthly_summary


def get_yearly_summary(employee_id, year):
    """Generates annual attendance aggregates with month-by-month trends for an employee."""
    employee_id = int(employee_id)
    employee = emp_repo.get_by_id(employee_id)
    if employee is None:
        return None

    first_name = _get_emp_field(employee, "first_name", "")
    last_name = _get_emp_field(employee, "last_name", "")
    emp_name = f"{first_name} {last_name}".strip()

    all_emp_records = repo.get_by_employee_id(employee_id)
    year_prefix = f"{year:04d}-"
    year_records = [r for r in all_emp_records if r.get("date", "").startswith(year_prefix)]

    records_by_month = {m: [] for m in range(1, 13)}
    for r in year_records:
        try:
            month_num = int(r["date"].split("-")[1])
            if 1 <= month_num <= 12:
                records_by_month[month_num].append(r)
        except (ValueError, IndexError):
            pass

    monthly_breakdown = []
    total_present = 0
    total_half_days = 0
    total_leaves = 0
    total_absent = 0
    total_annual_hours = 0.0

    for m in range(1, 13):
        records = records_by_month[m]
        days_present = sum(1 for r in records if r.get("status") == "present")
        days_half_day = sum(1 for r in records if r.get("status") == "half_day")
        days_on_leave = sum(1 for r in records if r.get("status") == "on_leave")
        days_absent = sum(1 for r in records if r.get("status") == "absent")
        total_hours_worked = round(sum(r.get("total_hours", 0.0) for r in records), 2)

        working_days_logged = days_present + days_half_day
        avg_daily_hours = (
            round(total_hours_worked / working_days_logged, 2)
            if working_days_logged > 0
            else 0.0
        )

        total_present += days_present
        total_half_days += days_half_day
        total_leaves += days_on_leave
        total_absent += days_absent
        total_annual_hours += total_hours_worked

        monthly_breakdown.append({
            "month": m,
            "month_name": calendar.month_name[m],
            "days_present": days_present,
            "days_half_day": days_half_day,
            "days_on_leave": days_on_leave,
            "days_absent": days_absent,
            "total_hours_worked": total_hours_worked,
            "avg_daily_hours": avg_daily_hours,
        })

    total_annual_hours = round(total_annual_hours, 2)
    active_months = sum(1 for m in monthly_breakdown if m["total_hours_worked"] > 0)
    avg_monthly_hours = round(total_annual_hours / active_months, 2) if active_months > 0 else 0.0

    return {
        "employee_id": employee_id,
        "employee_name": emp_name,
        "year": year,
        "total_days_present": total_present,
        "total_days_half_day": total_half_days,
        "total_days_on_leave": total_leaves,
        "total_days_absent": total_absent,
        "total_annual_hours": total_annual_hours,
        "avg_monthly_hours": avg_monthly_hours,
        "monthly_breakdown": monthly_breakdown,
    }


get_employee_yearly_attendance_summary = get_yearly_summary


def get_today_attendance_overview():
    """Provides a company-wide attendance status breakdown for today."""
    today_str = datetime.date.today().isoformat()
    all_employees = [
        e for e in emp_repo.get_all()
        if _get_emp_field(e, "employee_status") == "active"
    ]
    today_records = [r for r in repo.get_all() if r.get("date") == today_str]

    emp_lookup = {
        _get_emp_field(e, "emp_id", e.get("id") if isinstance(e, dict) else None): e
        for e in all_employees
    }
    record_by_emp = {r["employee_id"]: r for r in today_records}

    checked_in = []
    checked_out = []
    on_leave = []
    not_checked_in = []

    for emp_id, emp in emp_lookup.items():
        if emp_id is None:
            continue
        rec = record_by_emp.get(emp_id)
        first_name = _get_emp_field(emp, "first_name", "")
        last_name = _get_emp_field(emp, "last_name", "")
        emp_summary = {
            "employee_id": emp_id,
            "name": f"{first_name} {last_name}".strip(),
            "email": _get_emp_field(emp, "email"),
            "department_id": _get_emp_field(emp, "dept_id"),
        }
        if rec is None:
            not_checked_in.append(emp_summary)
        elif rec.get("status") == "on_leave":
            on_leave.append({**emp_summary, "notes": rec.get("notes")})
        elif rec.get("check_out") is None:
            checked_in.append({
                **emp_summary,
                "check_in": rec.get("check_in"),
                "work_mode": rec.get("work_mode"),
                "is_late": rec.get("is_late", False),
            })
        else:
            checked_out.append({
                **emp_summary,
                "check_in": rec.get("check_in"),
                "check_out": rec.get("check_out"),
                "total_hours": rec.get("total_hours"),
                "status": rec.get("status"),
            })

    return {
        "date": today_str,
        "summary_counts": {
            "total_active_employees": len(all_employees),
            "checked_in_now": len(checked_in),
            "checked_out": len(checked_out),
            "on_leave": len(on_leave),
            "not_checked_in": len(not_checked_in),
        },
        "checked_in_now": checked_in,
        "checked_out": checked_out,
        "on_leave": on_leave,
        "not_checked_in": not_checked_in,
    }
