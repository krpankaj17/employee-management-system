import datetime
import uuid
import pytest
from fastapi.testclient import TestClient


def test_attendance_checkin_checkout_flow(
    client: TestClient,
    employee_auth,
    employee_headers,
    admin_auth,
    admin_headers,
):
    emp_pid = employee_auth["employee_public_id"]
    admin_emp_pid = admin_auth["employee_public_id"]

    # 1. Validation: Employee cannot check-in for another employee
    forbidden_res = client.post(
        "/attendance/check-in",
        json={"employee_public_id": admin_emp_pid, "work_mode": "in_office"},
        headers=employee_headers,
    )
    assert forbidden_res.status_code == 403

    # 2. Check in for self (or if already checked in from a previous run, handles duplicate rejection)
    checkin_res = client.post(
        "/attendance/check-in",
        json={"employee_public_id": emp_pid, "work_mode": "in_office", "notes": "Pytest shift checkin"},
        headers=employee_headers,
    )
    if checkin_res.status_code == 201:
        cin_data = checkin_res.json()
        utc_today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
        assert cin_data["date"] in (datetime.date.today().isoformat(), utc_today)
        assert cin_data["check_in"] is not None
        assert cin_data["check_out"] is None

        # Duplicate check-in on the same day must be rejected with 409 Conflict
        dup_res = client.post(
            "/attendance/check-in",
            json={"employee_public_id": emp_pid, "work_mode": "in_office"},
            headers=employee_headers,
        )
        assert dup_res.status_code == 409
    else:
        # Already checked in today
        assert checkin_res.status_code == 409

    # 3. Check out
    checkout_res = client.post(
        "/attendance/check-out",
        json={"employee_public_id": emp_pid, "notes": "Pytest shift checkout"},
        headers=employee_headers,
    )
    assert checkout_res.status_code in (200, 409)
    if checkout_res.status_code == 200:
        cout_data = checkout_res.json()
        assert cout_data["check_out"] is not None
        assert cout_data["total_hours"] >= 0.0


def test_attendance_query_and_filtering(client: TestClient, admin_headers, employee_auth, employee_headers):
    emp_pid = employee_auth["employee_public_id"]
    today_str = datetime.date.today().isoformat()

    # 1. Query attendance records with employee filter
    list_res = client.get(
        f"/attendance/records?employee_public_id={emp_pid}",
        headers=admin_headers,
    )
    assert list_res.status_code == 200
    data = list_res.json()
    assert "items" in data
    assert "total" in data

    # 2. Query attendance with status=not_checked_in filter for today
    not_checked_res = client.get(
        f"/attendance/records?date_from={today_str}&date_to={today_str}&status=not_checked_in",
        headers=admin_headers,
    )
    assert not_checked_res.status_code == 200
    not_checked_data = not_checked_res.json()
    assert "items" in not_checked_data

    # 3. Regular employee querying /attendance/records is restricted to own records
    emp_query_res = client.get(
        "/attendance/records",
        headers=employee_headers,
    )
    assert emp_query_res.status_code == 200
    emp_items = emp_query_res.json()["items"]
    assert isinstance(emp_items, list)

    # 4. Verify status=not_checked_in items format
    if not_checked_data["items"]:
        first_missing = not_checked_data["items"][0]
        assert first_missing["status"] == "not_checked_in"
        assert first_missing["check_in"] is None


def test_attendance_admin_manual_entry(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]
    past_date = "2026-06-15"

    # 1. Admin creates manual attendance entry for past date
    manual_res = client.post(
        "/attendance/records",
        json={
            "employee_public_id": emp_pid,
            "date": past_date,
            "check_in": "09:00:00",
            "check_out": "18:00:00",
            "work_mode": "in_office",
            "status": "present",
            "notes": "Admin backfill test",
        },
        headers=admin_headers,
    )
    assert manual_res.status_code == 201
    manual_data = manual_res.json()
    record_id = manual_data.get("public_id") or manual_data.get("id")
    assert manual_data["date"] == past_date
    assert manual_data["total_hours"] == 9.0

    # 2. Admin updates attendance status/work_mode/notes (times remain unchanged)
    update_res = client.put(
        f"/attendance/records/{record_id}",
        json={
            "work_mode": "remote",
            "status": "half_day",
            "notes": "Updated to remote half day",
        },
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    upd_data = update_res.json()
    assert upd_data["status"] == "half_day"
    assert upd_data["work_mode"] == "remote"
    assert upd_data["check_in"] == "09:00:00"
    assert upd_data["check_out"] == "18:00:00"

    # 3. Admin deletes manual attendance entry
    del_res = client.delete(f"/attendance/records/{record_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_holiday_calendar_flow(client: TestClient, admin_headers, employee_headers):
    suffix = uuid.uuid4().hex[:6]
    holiday_name = f"Test Holiday {suffix}"
    # 1. Create Holiday with unique region/date (Admin only)
    create_res = client.post(
        "/holidays",
        json={
            "name": holiday_name,
            "date": "2026-11-20",
            "holiday_type": "optional",
            "year": 2026,
            "is_optional": True,
            "applicable_region": f"REG_{suffix}",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    hol = create_res.json()
    hol_pid = hol["public_id"]

    # 2. List Holidays as Admin and as Regular Employee
    list_admin_res = client.get("/holidays?year=2026", headers=admin_headers)
    assert list_admin_res.status_code == 200
    assert list_admin_res.json()["total"] >= 1

    list_emp_res = client.get("/holidays?year=2026", headers=employee_headers)
    assert list_emp_res.status_code == 200
    assert any(h["public_id"] == hol_pid for h in list_emp_res.json()["items"])

    # 3. Delete Holiday (Admin only)
    del_res = client.delete(f"/holidays/{hol_pid}", headers=admin_headers)
    assert del_res.status_code == 200


def test_employee_forbidden_from_attendance_admin_actions(
    client: TestClient,
    employee_headers,
    admin_headers,
    employee_auth,
    admin_auth,
):
    emp_pid = employee_auth["employee_public_id"]
    admin_emp_pid = admin_auth["employee_public_id"]
    test_date = "2026-05-10"

    # 1. Admin creates a record to test update/delete on
    admin_create_res = client.post(
        "/attendance/records",
        json={
            "employee_public_id": emp_pid,
            "date": test_date,
            "check_in": "09:00:00",
            "check_out": "17:00:00",
            "work_mode": "in_office",
            "status": "present",
            "notes": "Test attendance record",
        },
        headers=admin_headers,
    )
    assert admin_create_res.status_code == 201
    record_id = admin_create_res.json().get("public_id") or admin_create_res.json().get("id")

    try:
        # 2. Regular employee CANNOT manually create/backfill an attendance record for another
        emp_create_res = client.post(
            "/attendance/records",
            json={
                "employee_public_id": admin_emp_pid,
                "date": "2026-05-11",
                "check_in": "09:00:00",
                "check_out": "18:00:00",
                "work_mode": "in_office",
                "status": "present",
            },
            headers=employee_headers,
        )
        assert emp_create_res.status_code == 403

        # 3. Regular employee CANNOT update an attendance record
        emp_update_res = client.put(
            f"/attendance/records/{record_id}",
            json={
                "check_in": "08:30:00",
                "check_out": "17:30:00",
                "notes": "Employee unauthorized override",
            },
            headers=employee_headers,
        )
        assert emp_update_res.status_code == 403

        # 4. Regular employee CANNOT delete an attendance record
        emp_del_res = client.delete(
            f"/attendance/records/{record_id}",
            headers=employee_headers,
        )
        assert emp_del_res.status_code == 403

    finally:
        # Cleanup record with admin headers
        client.delete(f"/attendance/records/{record_id}", headers=admin_headers)


def test_timezone_aware_attendance_flow(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]
    test_date = "2026-07-20"

    # 1. Admin creates manual attendance specifying Tokyo timezone (Asia/Tokyo)
    manual_res = client.post(
        "/attendance/records",
        json={
            "employee_public_id": emp_pid,
            "date": test_date,
            "check_in": "09:00:00",
            "check_out": "17:30:00",
            "work_mode": "remote",
            "status": "present",
            "timezone": "Asia/Tokyo",
            "notes": "Tokyo remote shift",
        },
        headers=admin_headers,
    )
    assert manual_res.status_code == 201
    rec = manual_res.json()
    record_id = rec.get("public_id") or rec.get("id")
    assert rec["timezone"] == "Asia/Tokyo"
    assert rec["total_hours"] == 8.5
    assert "created_at" not in rec
    assert "updated_at" not in rec

    # 2. Query record and verify timezone persistence
    get_res = client.get(f"/attendance/records?employee_public_id={emp_pid}&date_from={test_date}&date_to={test_date}", headers=admin_headers)
    assert get_res.status_code == 200
    items = get_res.json()["items"]
    assert len(items) >= 1
    assert any((i.get("public_id") == record_id or i.get("id") == record_id) and i["timezone"] == "Asia/Tokyo" for i in items)

    # 3. Update record with new timezone (e.g. America/New_York)
    update_tz_res = client.put(
        f"/attendance/records/{record_id}",
        json={"timezone": "America/New_York", "notes": "Shift reassigned to NY"},
        headers=admin_headers,
    )
    assert update_tz_res.status_code == 200
    upd_rec = update_tz_res.json()
    assert upd_rec["timezone"] == "America/New_York"
    assert upd_rec["notes"] == "Shift reassigned to NY"

    # 4. Cleanup
    del_res = client.delete(f"/attendance/records/{record_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_auto_checkout_unclosed_yesterday_shift(client: TestClient, admin_headers, employee_auth, employee_headers):
    emp_pid = employee_auth["employee_public_id"]
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    # 1. Admin creates an unclosed check-in for yesterday (check_in present, check_out None)
    create_res = client.post(
        "/attendance/records",
        json={
            "employee_public_id": emp_pid,
            "date": yesterday,
            "check_in": "09:00:00",
            "check_out": None,
            "work_mode": "in_office",
            "status": "present",
            "notes": "Unclosed yesterday shift test",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    rec = create_res.json()
    record_id = rec.get("public_id") or rec.get("id")

    try:
        # 2. Trigger query - previous day unclosed shift must be automatically closed
        query_res = client.get(
            f"/attendance/records?employee_public_id={emp_pid}&date_from={yesterday}&date_to={yesterday}",
            headers=employee_headers,
        )
        assert query_res.status_code == 200
        items = query_res.json()["items"]
        yest_rec = next((i for i in items if i.get("date") == yesterday), None)
        assert yest_rec is not None
        assert yest_rec["check_out"] is not None
        assert yest_rec["total_hours"] == 9.0
        assert "Auto Check-out" in (yest_rec.get("notes") or "")
    finally:
        client.delete(f"/attendance/records/{record_id}", headers=admin_headers)




