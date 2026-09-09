import uuid
import pytest
from fastapi.testclient import TestClient


def test_unauthenticated_requests_blocked(client: TestClient):
    # Missing Authorization Header
    res1 = client.get("/departments")
    assert res1.status_code == 401

    res2 = client.get("/employees/search")
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

    # 7. Employee search is scoped to own record only
    res7 = client.get("/employees/search?employee_status=active", headers=employee_headers)
    assert res7.status_code == 200
    assert len(res7.json()["items"]) <= 1

    # 8. Employee cannot query another employee's reviews
    res8 = client.get(f"/reviews?employee_public_id={admin_emp_pid}", headers=employee_headers)
    assert res8.status_code == 403

    # 9. Employee cannot list all departments
    res9 = client.get("/departments", headers=employee_headers)
    assert res9.status_code == 403


def test_employee_can_view_own_profile(
    client: TestClient,
    employee_auth,
    employee_headers,
):
    self_emp_pid = employee_auth["employee_public_id"]
    res = client.get("/employees/me", headers=employee_headers)
    assert res.status_code == 200
    assert res.json()["public_id"] == self_emp_pid


def test_review_access_controls(
    client: TestClient,
    admin_headers,
    hr_headers,
    employee_headers,
    admin_auth,
    hr_auth,
    employee_auth,
):
    # 1. Plain user signup (user with NO employee record)
    signup_res = client.post(
        "/auth/signup",
        json={
            "email": f"plain.user.{uuid.uuid4().hex[:6]}@company.com",
            "password": "SecurePassword123!",
            "display_name": "Plain User",
        },
    )
    assert signup_res.status_code == 201
    plain_token = signup_res.json()["tokens"]["access_token"]
    plain_headers = {"Authorization": f"Bearer {plain_token}"}

    # Plain user cannot list reviews (no employee profile)
    res_plain_list = client.get("/reviews", headers=plain_headers)
    assert res_plain_list.status_code == 403

    # 2. Create a review for Admin conducted by HR
    create_res = client.post(
        "/reviews",
        json={
            "employee_public_id": admin_auth["employee_public_id"],
            "reviewer_public_id": hr_auth["employee_public_id"],
            "review_period_start": "2026-01-01",
            "review_period_end": "2026-06-30",
            "rating": 4.9,
            "comments": "Executive performance review",
            "status": "draft",
        },
        headers=hr_headers,
    )
    assert create_res.status_code == 201
    admin_rev_pid = create_res.json()["public_id"]

    # 3. Regular employee CANNOT view Admin's review by ID
    res_emp_get_admin_rev = client.get(f"/reviews/{admin_rev_pid}", headers=employee_headers)
    assert res_emp_get_admin_rev.status_code == 403

    # 4. Regular employee CANNOT update Admin's review
    res_emp_update_admin_rev = client.put(
        f"/reviews/{admin_rev_pid}",
        json={"rating": 1.0, "comments": "Hacked"},
        headers=employee_headers,
    )
    assert res_emp_update_admin_rev.status_code == 403

    # 5. Plain user CANNOT view review by ID
    res_plain_get_rev = client.get(f"/reviews/{admin_rev_pid}", headers=plain_headers)
    assert res_plain_get_rev.status_code == 403


def test_audit_logs_rbac_and_schema(
    client: TestClient,
    admin_headers,
    employee_headers,
):
    # 1. Admin can access audit logs
    admin_res = client.get("/audit-logs", headers=admin_headers)
    assert admin_res.status_code == 200
    data = admin_res.json()
    assert "total" in data
    assert "items" in data

    # 2. Employee receives 403 Forbidden
    emp_res = client.get("/audit-logs", headers=employee_headers)
    assert emp_res.status_code == 403


