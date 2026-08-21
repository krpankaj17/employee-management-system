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
        assert cin_data["date"] == datetime.date.today().isoformat()
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


def test_attendance_query_and_summaries(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]
    now = datetime.date.today()

    # 1. Query attendance records
    list_res = client.get(
        f"/attendance/records?employee_public_id={emp_pid}",
        headers=admin_headers,
    )
    assert list_res.status_code == 200
    data = list_res.json()
    assert "items" in data

    # 2. Monthly Summary
    monthly_res = client.get(
        f"/attendance/employees/{emp_pid}/monthly-summary?year={now.year}&month={now.month}",
        headers=admin_headers,
    )
    assert monthly_res.status_code == 200
    summary = monthly_res.json()
    assert summary["year"] == now.year
    assert summary["month"] == now.month
    assert "days_present" in summary

    # 3. Today's Overview Snapshot
    overview_res = client.get("/attendance/today/overview", headers=admin_headers)
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert "summary_counts" in overview
    assert "total_active_employees" in overview["summary_counts"]


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
    record_id = manual_data["id"]
    assert manual_data["date"] == past_date
    assert manual_data["total_hours"] == 9.0

    # 2. Admin deletes manual attendance entry
    del_res = client.delete(f"/attendance/records/{record_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_holiday_calendar_flow(client: TestClient, admin_headers):
    suffix = uuid.uuid4().hex[:6]
    holiday_name = f"Test Holiday {suffix}"
    # 1. Create Holiday with unique region/date
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

    # 2. List Holidays
    list_res = client.get("/holidays?year=2026", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 3. Delete Holiday
    del_res = client.delete(f"/holidays/{hol_pid}", headers=admin_headers)
    assert del_res.status_code == 200

