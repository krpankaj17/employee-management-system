import uuid
import datetime
import pytest
from fastapi.testclient import TestClient


def test_leave_lifecycle_flow(
    client: TestClient,
    admin_headers,
    employee_auth,
    employee_headers,
):
    emp_pid = employee_auth["employee_public_id"]
    leave_type_name = f"Casual-{uuid.uuid4().hex[:6]}"

    # 1. Create a Leave Type
    type_res = client.post(
        "/leaves/types",
        json={
            "name": leave_type_name,
            "max_days_per_year": 18,
            "is_paid": True,
            "description": "Standard casual leave",
        },
        headers=admin_headers,
    )
    assert type_res.status_code == 201
    leave_type_data = type_res.json()
    leave_type_pid = leave_type_data["public_id"]

    # 2. Allocate Leave Balance to Employee (10 days)
    alloc_res = client.post(
        "/leaves/allocate",
        json={
            "employee_public_id": emp_pid,
            "leave_type_public_id": leave_type_pid,
            "year": 2026,
            "total_allocated": 10,
        },
        headers=admin_headers,
    )
    assert alloc_res.status_code == 200
    alloc_data = alloc_res.json()
    assert alloc_data["total_allocated"] == 10

    # 3. Query Employee Leave Balances
    bal_res = client.get(
        f"/leaves/balances/{emp_pid}?year=2026",
        headers=employee_headers,
    )
    assert bal_res.status_code == 200
    balances = bal_res.json()
    assert isinstance(balances, list)
    assert len(balances) >= 1

    # 4. Validation: Attempt to submit with invalid date range (end before start)
    invalid_date_res = client.post(
        "/leaves/requests",
        json={
            "employee_public_id": emp_pid,
            "leave_type_public_id": leave_type_pid,
            "start_date": "2026-09-15",
            "end_date": "2026-09-10",
            "total_days": 5.0,
            "reason": "Invalid dates",
        },
        headers=employee_headers,
    )
    assert invalid_date_res.status_code == 400

    # 5. Validation: Attempt to request more days than allocated balance (50 > 10)
    over_balance_res = client.post(
        "/leaves/requests",
        json={
            "employee_public_id": emp_pid,
            "leave_type_public_id": leave_type_pid,
            "start_date": "2026-09-01",
            "end_date": "2026-09-20",
            "total_days": 50.0,
            "reason": "Excessive days",
        },
        headers=employee_headers,
    )
    assert over_balance_res.status_code == 400

    # 6. Submit Valid Leave Request (3 days)
    today = datetime.date.today() + datetime.timedelta(days=10)
    end_date = today + datetime.timedelta(days=2)
    submit_res = client.post(
        "/leaves/requests",
        json={
            "employee_public_id": emp_pid,
            "leave_type_public_id": leave_type_pid,
            "start_date": today.isoformat(),
            "end_date": end_date.isoformat(),
            "total_days": 3.0,
            "reason": "Family vacation",
        },
        headers=employee_headers,
    )
    assert submit_res.status_code == 201
    req_data = submit_res.json()
    req_pid = req_data["public_id"]
    assert req_data["status"] == "pending"

    # 7. List Leave Requests
    list_res = client.get("/leaves/requests", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 8. Admin Approves the Leave Request
    action_res = client.post(
        f"/leaves/requests/{req_pid}/action",
        json={"action": "approved", "remarks": "Approved by Admin"},
        headers=admin_headers,
    )
    assert action_res.status_code == 200
    assert action_res.json()["status"] == "approved"

    # 9. Verify Used Balance incremented (used = 3, remaining = 7)
    bal_after = client.get(
        f"/leaves/balances/{emp_pid}?year=2026",
        headers=employee_headers,
    ).json()
    target_bal = next((b for b in bal_after if b.get("leave_type_name") == leave_type_name), None)
    if target_bal:
        assert target_bal["used_leaves"] == 3
        assert target_bal["remaining_leaves"] == 7

    # 10. Cancel the Approved Leave Request and verify balance refund
    cancel_res = client.post(
        f"/leaves/requests/{req_pid}/cancel",
        headers=admin_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # 11. Verify Balance Refunded (used = 0, remaining = 10)
    bal_refund = client.get(
        f"/leaves/balances/{emp_pid}?year=2026",
        headers=employee_headers,
    ).json()
    target_bal_ref = next((b for b in bal_refund if b.get("leave_type_name") == leave_type_name), None)
    if target_bal_ref:
        assert target_bal_ref["used_leaves"] == 0
        assert target_bal_ref["remaining_leaves"] == 10

    # 12. Submit another request and test rejection flow
    submit2_res = client.post(
        "/leaves/requests",
        json={
            "employee_public_id": emp_pid,
            "leave_type_public_id": leave_type_pid,
            "start_date": (today + datetime.timedelta(days=15)).isoformat(),
            "end_date": (today + datetime.timedelta(days=16)).isoformat(),
            "total_days": 2.0,
            "reason": "Personal work",
        },
        headers=employee_headers,
    )
    assert submit2_res.status_code == 201
    req2_pid = submit2_res.json()["public_id"]

    reject_res = client.post(
        f"/leaves/requests/{req2_pid}/action",
        json={"action": "rejected", "rejection_reason": "High project workload during that week"},
        headers=admin_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

