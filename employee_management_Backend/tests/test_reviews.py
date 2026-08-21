import uuid
import pytest
from fastapi.testclient import TestClient


def test_performance_review_lifecycle(client: TestClient, admin_headers, employee_auth, hr_auth):
    emp_pid = employee_auth["employee_public_id"]
    reviewer_pid = hr_auth["employee_public_id"]

    # 1. Validation: Self-review prohibited
    self_rev_res = client.post(
        "/reviews",
        json={
            "employee_public_id": emp_pid,
            "reviewer_public_id": emp_pid,  # Same employee
            "review_period_start": "2026-01-01",
            "review_period_end": "2026-06-30",
            "rating": 4.0,
            "comments": "Self evaluation",
        },
        headers=admin_headers,
    )
    assert self_rev_res.status_code == 400

    # 2. Validation: End date cannot be before start date
    invalid_dates_res = client.post(
        "/reviews",
        json={
            "employee_public_id": emp_pid,
            "reviewer_public_id": reviewer_pid,
            "review_period_start": "2026-06-30",
            "review_period_end": "2026-01-01",
            "rating": 4.0,
            "comments": "Invalid date range",
        },
        headers=admin_headers,
    )
    assert invalid_dates_res.status_code == 400

    # 3. Create Valid Performance Review
    create_res = client.post(
        "/reviews",
        json={
            "employee_public_id": emp_pid,
            "reviewer_public_id": reviewer_pid,
            "review_period_start": "2026-01-01",
            "review_period_end": "2026-06-30",
            "rating": 4.5,
            "comments": "Consistently exceeded expectations on delivery milestones.",
            "status": "draft",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    rev_data = create_res.json()
    rev_pid = rev_data["public_id"]
    assert rev_data["rating"] == 4.5
    assert rev_data["status"] == "draft"

    # 4. Get Performance Review by UUID
    get_res = client.get(f"/reviews/{rev_pid}", headers=admin_headers)
    assert get_res.status_code == 200
    assert get_res.json()["public_id"] == rev_pid

    # 5. Update / Finalize Review
    update_res = client.put(
        f"/reviews/{rev_pid}",
        json={"status": "finalized", "rating": 4.8, "comments": "Finalized with stellar rating"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "finalized"
    assert update_res.json()["rating"] == 4.8

    # 6. List Reviews
    list_res = client.get(f"/reviews?employee_public_id={emp_pid}", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

