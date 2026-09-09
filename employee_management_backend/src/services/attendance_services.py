# attendance_services.py
import datetime
import calendar
import zoneinfo
import uuid
import utils
from repository import attendance_repository as repo
from repository import employee_repository as emp_repo

VALID_WORK_MODES = {"in_office", "remote", "field"}
VALID_STATUSES = {"present", "half_day", "absent", "on_leave", "not_checked_in"}
TIME_FORMATS = ["%H:%M:%S", "%H:%M"]

# Standard shift start time (09:00 AM), grace threshold (09:15 AM), and standard shift end (06:00 PM)
STANDARD_SHIFT_START = datetime.time(9, 0, 0)
GRACE_SHIFT_THRESHOLD = datetime.time(9, 15, 0)
STANDARD_SHIFT_END = datetime.time(18, 0, 0)


def auto_close_past_unclosed_check_ins(employee_id=None, before_date_str=None):
    """Automatically assigns an end-of-shift checkout time (18:00 or check_in + 8 hrs)
    to any unclosed check-in from a previous calendar day.
    This prevents employees who forgot to check out yesterday from ever being blocked
    from checking in today."""
    try:
        past_unclosed = repo.get_past_unclosed_check_ins(
            e_id=employee_id,
            before_date_str=before_date_str,
        )
        if not past_unclosed:
            return []

        closed_records = []
        for rec in past_unclosed:
            rec_id = rec.get("id") or rec.get("attendance_id")
            rec_date_str = rec.get("date")
            rec_emp_id = rec.get("employee_id")
            emp = emp_repo.get_by_id(rec_emp_id) if rec_emp_id else None

            # Resolve timezone
            emp_tz_name = rec.get("timezone") or _get_emp_field(emp, "timezone") or "UTC"
            tz, tz_name = _get_tz(emp_tz_name)

            # Always anchor shift to the record's calendar date
            try:
                rec_date = datetime.date.fromisoformat(str(rec_date_str)[:10]) if rec_date_str else datetime.date.today()
            except ValueError:
                rec_date = datetime.date.today()

            # Determine check-in timestamp in local timezone anchored to rec_date
            cin_val = rec.get("check_in") or rec.get("check_in_time")
            cin_parsed = _parse_datetime_or_time(cin_val)
            cin_time = cin_parsed.time() if cin_parsed else STANDARD_SHIFT_START
            cin_dt = datetime.datetime.combine(rec_date, cin_time, tzinfo=tz)

            shift_end_dt = datetime.datetime.combine(rec_date, STANDARD_SHIFT_END, tzinfo=tz)

            # Assign auto checkout timestamp:
            # If check-in was at least 30 mins before 18:00, use 18:00.
            # Otherwise (checked in close to/after 18:00), assign check_in + 8 hours or 23:59:59.
            if cin_dt < shift_end_dt and (shift_end_dt - cin_dt).total_seconds() >= 1800:
                cout_dt = shift_end_dt
            else:
                end_of_day = datetime.datetime.combine(rec_date, datetime.time(23, 59, 59), tzinfo=tz)
                cout_dt = min(cin_dt + datetime.timedelta(hours=8), end_of_day)

            # Format checkout matching check_in format (plain HH:MM:SS vs ISO datetime)
            if "T" in str(cin_val):
                cout_val = cout_dt.isoformat()
            else:
                cout_val = cout_dt.strftime("%H:%M:%S")

            total_hours = round(max(0.0, (cout_dt - cin_dt).total_seconds() / 3600.0), 2)

            time_str = cout_dt.strftime("%H:%M")
            auto_tag = f"[Auto Check-out at {time_str} (missed punch-out)]"
            orig_notes = rec.get("notes") or ""
            updated_notes = f"{orig_notes} | {auto_tag}".strip(" |") if auto_tag not in orig_notes else orig_notes

            updated = repo.update(rec_id, {
                "check_out": cout_val,
                "total_hours": total_hours,
                "status": "present",
                "notes": updated_notes,
            })
            if updated:
                utils.log_action(
                    "ATTENDANCE_AUTO_CHECKOUT",
                    f"id={rec_id} emp_id={rec_emp_id} date={rec_date_str} in={cin_val} out={cout_iso} total_hours={total_hours}",
                )
                closed_records.append(_enrich_record(updated))

        return closed_records
    except Exception as e:
        utils.log_action("ATTENDANCE_AUTO_CHECKOUT_FAILED", f"emp_id={employee_id} error: {e}")
        return []


def _enrich_record(record):
    if not record:
        return record
    r = dict(record)
    if "public_id" not in r or not r["public_id"]:
        r["public_id"] = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"att_{r.get('id', 0)}_{r.get('date', '')}"))
    if "employee_public_id" not in r or not r["employee_public_id"]:
        emp_id = r.get("employee_id")
        if emp_id:
            emp = emp_repo.get_by_id(emp_id)
            if emp:
                r["employee_public_id"] = str(emp.public_id)
    return r


def _get_tz(tz_name: str | None) -> tuple[datetime.tzinfo, str]:
    if not tz_name or not isinstance(tz_name, str) or not tz_name.strip():
        return datetime.timezone.utc, "UTC"
    tz_clean = tz_name.strip()
    try:
        return zoneinfo.ZoneInfo(tz_clean), tz_clean
    except Exception:
        return datetime.timezone.utc, "UTC"


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


def _parse_datetime_or_time(val):
    """Parses an ISO datetime string or %H:%M:%S / %H:%M time string into a datetime object."""
    if not val:
        return None
    if isinstance(val, datetime.datetime):
        return val
    if isinstance(val, datetime.time):
        return datetime.datetime.combine(datetime.date.min, val)
    if not isinstance(val, str):
        return None
    val = val.strip()
    # Try ISO datetime
    try:
        dt = datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
        return dt
    except Exception:
        pass
    # Try plain time formats
    for fmt in TIME_FORMATS:
        try:
            t = datetime.datetime.strptime(val, fmt).time()
            return datetime.datetime.combine(datetime.date.min, t)
        except ValueError:
            pass
    return None


def _parse_time_str(time_str):
    """Parses a time string in %H:%M:%S or %H:%M format into a datetime.time object."""
    dt = _parse_datetime_or_time(time_str)
    return dt.time() if dt is not None else None


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
            if t and t > datetime.datetime.now(datetime.timezone.utc).time():
                return True
    except (ValueError, TypeError):
        pass
    return False


def _calculate_hours(check_in_str, check_out_str):
    """Calculates total hours worked between check_in and check_out strings.
    Returns float rounded to 2 decimal places."""
    dt_in = _parse_datetime_or_time(check_in_str)
    dt_out = _parse_datetime_or_time(check_out_str)
    if not dt_in or not dt_out:
        return 0.0
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
    """Determines attendance status based on standard working hours.
    Any employee who checks in and out has recorded attendance and is marked 'present'."""
    return "present"


# ─── Core Live Punch Operations (Server-Authoritative) ─────────────────────────

def check_in_employee(employee_id, work_mode="in_office", notes=None, timezone=None):
    """Records an employee live check-in using the current UTC timestamp and employee's local timezone.
    Client CANNOT pass date or time - server authority strictly enforced.
    Strict Rule: Check-in is allowed ONLY ONCE per day per employee."""
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

        # Resolve timezone (explicit timezone > employee timezone > UTC)
        emp_tz_name = timezone or _get_emp_field(employee, "timezone") or "UTC"
        tz, tz_name = _get_tz(emp_tz_name)

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_local = now_utc.astimezone(tz)
        today_str = now_local.date().isoformat()
        now_iso = now_utc.isoformat()

        # Strict Rule: Check-in is allowed ONLY ONCE per calendar day
        existing_today = repo.get_by_employee_and_date(employee_id, today_str)
        if existing_today:
            open_rec = next((r for r in existing_today if r.get("check_out") is None), None)
            if open_rec is not None:
                return {
                    "ok": False,
                    "error": "conflict",
                    "message": f"You are already checked in for today ({today_str}). Active check-in at {open_rec.get('check_in')}.",
                }
            return {
                "ok": False,
                "error": "conflict",
                "message": f"Check-in is only allowed once per day. Your shift for today ({today_str}) has already been completed.",
            }

        # Auto-close any unclosed check-in from previous calendar days so employee is never locked out
        auto_close_past_unclosed_check_ins(employee_id=employee_id, before_date_str=today_str)

        is_late, late_minutes = _check_late_arrival(now_local.time())
        auto_notes = notes.strip() if notes else ""
        if is_late:
            late_tag = f"[Late Arrival: {late_minutes} mins past 09:00]"
            auto_notes = f"{late_tag} {auto_notes}".strip()

        new_record = {
            "employee_id": employee_id,
            "date": today_str,
            "check_in": now_iso,
            "check_out": None,
            "timezone": tz_name,
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
            f"emp_id={employee_id} tz={tz_name} date={today_str} in={now_iso} mode={work_mode} is_late={is_late}",
        )
        return {"ok": True, "record": _enrich_record(created)}
    except Exception as e:
        utils.log_action("ATTENDANCE_CHECK_IN_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def check_out_employee(employee_id, notes=None):
    """Records an employee live check-out using current UTC timestamp."""
    try:
        employee_id = int(employee_id)
        if emp_repo.get_by_id(employee_id) is None:
            return {"ok": False, "error": "not_found", "message": f"Employee with id {employee_id} not found"}

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        now_iso = now_utc.isoformat()
        today_str = now_utc.date().isoformat()

        # Ensure past unclosed shifts from previous days are auto-closed
        auto_close_past_unclosed_check_ins(employee_id=employee_id, before_date_str=today_str)

        open_record = repo.get_open_check_in(employee_id, None)
        if open_record is None:
            today_str = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
            today_records = repo.get_by_employee_and_date(employee_id, today_str)
            if any(r.get("check_out") is not None for r in today_records):
                return {
                    "ok": False,
                    "error": "conflict",
                    "message": f"You have already checked out for today ({today_str}).",
                }
            return {
                "ok": False,
                "error": "not_found",
                "message": f"No open check-in record found for employee {employee_id}",
            }

        total_hours = _calculate_hours(open_record["check_in"], now_iso)
        # Any employee who checks in and checks out is marked 'present', never 'absent'
        status = "present"

        updated_fields = {
            "check_out": now_iso,
            "total_hours": total_hours,
            "status": status,
        }
        if notes:
            existing_notes = open_record.get("notes")
            updated_fields["notes"] = f"{existing_notes} | {notes.strip()}" if existing_notes else notes.strip()

        updated_record = repo.update(open_record["id"], updated_fields)

        utils.log_action(
            "ATTENDANCE_CHECK_OUT",
            f"emp_id={employee_id} date={open_record.get('date')} out={now_iso} total_hours={total_hours} status={status}",
        )
        return {"ok": True, "record": _enrich_record(updated_record)}
    except Exception as e:
        utils.log_action("ATTENDANCE_CHECK_OUT_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def create_manual_record(employee_id, date_str, check_in=None, check_out=None,
                         work_mode="in_office", status="present", notes=None, timezone="UTC"):
    """Allows manual creation of attendance by Administrators / HR (e.g. past dates, leaves, administrative overrides)."""
    try:
        employee_id = int(employee_id)
        employee = emp_repo.get_by_id(employee_id)
        if employee is None:
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
        t_in = _parse_datetime_or_time(check_in) if check_in else None
        t_out = _parse_datetime_or_time(check_out) if check_out else None

        if check_in and t_in is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_in time format. Use HH:MM:SS or ISO timestamp"}
        if check_out and t_out is None:
            return {"ok": False, "error": "validation", "message": "Invalid check_out time format. Use HH:MM:SS or ISO timestamp"}

        if t_in and t_out and t_out <= t_in:
            return {"ok": False, "error": "validation", "message": "check_out time must be after check_in time"}

        # Calculate hours and late metrics
        total_hours = _calculate_hours(check_in, check_out) if (check_in and check_out) else 0.0
        is_late = False
        late_minutes = 0
        if t_in:
            is_late, late_minutes = _check_late_arrival(t_in.time())

        tz, tz_name = _get_tz(timezone or _get_emp_field(employee, "timezone") or "UTC")

        new_record = {
            "employee_id": employee_id,
            "date": date_str,
            "check_in": check_in,
            "check_out": check_out,
            "timezone": tz_name,
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
            f"emp_id={employee_id} date={date_str} in={check_in} out={check_out} tz={tz_name} status={status}",
        )
        return {"ok": True, "record": _enrich_record(created)}
    except Exception as e:
        utils.log_action("ATTENDANCE_MANUAL_CREATE_FAILED", f"emp_id={employee_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


create_manual_attendance = create_manual_record


def update_attendance_record(a_id, work_mode=None, status=None, notes=None, timezone=None, check_in=None, check_out=None):
    """Updates an existing attendance record (status, work_mode, timezone, notes, punch timestamps)."""
    try:
        existing = repo.get_by_id(a_id)
        if existing is None:
            return {"ok": False, "error": "not_found", "message": f"Attendance record {a_id} not found"}

        effective_status = status.strip().lower() if status is not None else existing.get("status")
        effective_mode = work_mode.strip().lower() if work_mode is not None else existing.get("work_mode")

        if effective_status not in VALID_STATUSES:
            return {"ok": False, "error": "validation", "message": f"status must be one of {sorted(VALID_STATUSES)}"}
        if effective_mode not in VALID_WORK_MODES:
            return {"ok": False, "error": "validation", "message": f"work_mode must be one of {sorted(VALID_WORK_MODES)}"}

        updates = {
            "work_mode": effective_mode,
            "status": effective_status,
        }
        if timezone is not None and str(timezone).strip():
            _, tz_name = _get_tz(str(timezone))
            updates["timezone"] = tz_name
        if notes is not None:
            updates["notes"] = notes.strip() if notes else None

        eff_check_in = check_in if check_in is not None else existing.get("check_in")
        eff_check_out = check_out if check_out is not None else existing.get("check_out")
        if check_in is not None:
            updates["check_in"] = check_in
        if check_out is not None:
            updates["check_out"] = check_out

        if check_in is not None or check_out is not None:
            total_hours = _calculate_hours(eff_check_in, eff_check_out)
            updates["total_hours"] = total_hours

        updated_record = repo.update(a_id, updates)
        utils.log_action("ATTENDANCE_UPDATE", f"id={a_id} updates={updates}")
        return {"ok": True, "record": _enrich_record(updated_record)}
    except Exception as e:
        utils.log_action("ATTENDANCE_UPDATE_FAILED", f"id={a_id} error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


update_record = update_attendance_record


def delete_attendance_record(a_id):
    """Deletes an attendance record by ID or public_id."""
    try:
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
    """Retrieves paginated and filtered attendance records across the enterprise.
    If status == 'not_checked_in', computes missing punch records for active employees."""
    try:
        auto_close_past_unclosed_check_ins(employee_id=employee_id)
    except Exception:
        pass

    if status and status.strip().lower() == "not_checked_in":
        target_start_str = date_from or datetime.date.today().isoformat()
        target_end_str = date_to or date_from or datetime.date.today().isoformat()

        try:
            start_date = datetime.date.fromisoformat(target_start_str)
            end_date = datetime.date.fromisoformat(target_end_str)
        except ValueError:
            start_date = datetime.date.today()
            end_date = datetime.date.today()

        if start_date > end_date:
            start_date, end_date = end_date, start_date

        dates = []
        cur = start_date
        while cur <= end_date and len(dates) < 31:
            dates.append(cur.isoformat())
            cur += datetime.timedelta(days=1)

        all_emps = [
            e for e in emp_repo.get_all()
            if _get_emp_field(e, "employee_status", "active") == "active"
        ]

        if department_id is not None:
            department_id = utils.convert_string_to_integer(department_id) if isinstance(department_id, str) else department_id
            all_emps = [e for e in all_emps if _get_emp_field(e, "dept_id") == department_id]

        if employee_id is not None:
            employee_id = utils.convert_string_to_integer(employee_id) if isinstance(employee_id, str) else employee_id
            all_emps = [e for e in all_emps if _get_emp_field(e, "emp_id", e.get("id") if isinstance(e, dict) else None) == employee_id]

        existing_records = repo.get_all()
        punched_emp_dates = {
            (r.get("employee_id"), r.get("date"))
            for r in existing_records
            if r.get("date") in dates and r.get("check_in") is not None
        }

        not_checked_in_records = []
        for d in dates:
            for emp in all_emps:
                emp_id = _get_emp_field(emp, "emp_id", emp.get("id") if isinstance(emp, dict) else None)
                if emp_id is not None and (emp_id, d) not in punched_emp_dates:
                    not_checked_in_records.append({
                        "id": 0,
                        "employee_id": emp_id,
                        "date": d,
                        "check_in": None,
                        "check_out": None,
                        "work_mode": work_mode or "in_office",
                        "status": "not_checked_in",
                        "total_hours": 0.0,
                        "is_late": False,
                        "late_minutes": 0,
                        "notes": "Employee has not checked in",
                        "created_at": datetime.datetime.now().isoformat(),
                        "updated_at": datetime.datetime.now().isoformat(),
                    })

        not_checked_in_records.sort(key=lambda x: (x.get("date", ""), x.get("employee_id", 0)), reverse=True)
        total = len(not_checked_in_records)
        items = not_checked_in_records[skip: skip + limit] if limit is not None else not_checked_in_records[skip:]
        return {"total": total, "skip": skip, "limit": limit, "items": items}

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
    enriched_items = [_enrich_record(r) for r in items]
    return {"total": total, "skip": skip, "limit": limit, "items": enriched_items}


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
        "employee_public_id": str(employee.public_id),
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
        "records": [_enrich_record(r) for r in records],
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
        "employee_public_id": str(employee.public_id),
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
    try:
        auto_close_past_unclosed_check_ins()
    except Exception:
        pass
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
