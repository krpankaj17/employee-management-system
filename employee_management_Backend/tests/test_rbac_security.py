import uuid
import pytest
from fastapi.testclient import TestClient


def test_unauthenticated_requests_blocked(client: TestClient):
    # Missing Authorization Header
    res1 = client.get("/departments")
    assert res1.status_code == 401

    res2 = client.post("/employees", json={})
    assert res2.status_code == 401

    res3 = client.get("/auth/me")
    assert res3.status_code == 401


def test_employee_forbidden_from_admin_endpoints(
    client: TestClient,
    employee_headers,
    admin_auth,
):
    admin_emp_pid = admin_auth["employee_public_id"]

    # 1. Employee cannot create a department (requires department:create)
    res1 = client.post(
        "/departments",
        json={"dept_name": "Unauthorized Dept", "dept_code": "UNAUTH", "description": "Fail"},
        headers=employee_headers,
    )
    assert res1.status_code == 403

    # 2. Employee cannot create a designation (requires employee:create)
    res2 = client.post(
        "/designations",
        json={"title": "Unauthorized Title"},
        headers=employee_headers,
    )
    assert res2.status_code == 403

    # 3. Employee cannot create salary structure (requires salary:create)
    res3 = client.post(
        "/salaries",
        json={
            "employee_public_id": admin_emp_pid,
            "basic_salary": 100000.0,
            "effective_from": "2026-01-01",
            "components": [],
        },
        headers=employee_headers,
    )
    assert res3.status_code == 403

    # 4. Employee cannot run batch payroll (requires payroll:run)
    res4 = client.post(
        "/payroll/process",
        json={
            "pay_period_start": "2026-08-01",
            "pay_period_end": "2026-08-31",
            "payment_date": "2026-08-31",
        },
        headers=employee_headers,
    )
    assert res4.status_code == 403

    # 5. Employee cannot create leave types (requires leave:approve)
    res5 = client.post(
        "/leaves/types",
        json={"name": "Forbidden Leave", "max_days_per_year": 10},
        headers=employee_headers,
    )
    assert res5.status_code == 403

    # 6. Employee cannot delete department (requires department:delete)
    fake_uuid = str(uuid.uuid4())
    res6 = client.delete(f"/departments/{fake_uuid}", headers=employee_headers)
    assert res6.status_code == 403
