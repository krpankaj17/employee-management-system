import uuid
import pytest
from fastapi.testclient import TestClient


def test_project_lifecycle_flow(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]
    proj_name = f"Cloud Platform {uuid.uuid4().hex[:6]}"

    # 1. Validation: End date before start date rejected
    bad_dates_res = client.post(
        "/projects",
        json={
            "project_name": "Invalid Project",
            "start_date": "2026-12-31",
            "end_date": "2026-01-01",
            "status": "planning",
        },
        headers=admin_headers,
    )
    assert bad_dates_res.status_code == 400

    # 2. Create Project
    create_res = client.post(
        "/projects",
        json={
            "project_name": proj_name,
            "description": "Enterprise cloud platform initiative",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "status": "planning",
            "head_employee_public_id": emp_pid,
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201

    proj_data = create_res.json()
    proj_pid = proj_data["public_id"]
    assert proj_data["project_name"] == proj_name

    # 2. Get Project by UUID
    get_res = client.get(f"/projects/{proj_pid}", headers=admin_headers)
    assert get_res.status_code == 200
    assert get_res.json()["public_id"] == proj_pid

    # 3. Update Project
    update_res = client.put(
        f"/projects/{proj_pid}",
        json={"status": "active", "description": "Active in development"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "active"

    # 4. Add Project Member
    member_res = client.post(
        f"/projects/{proj_pid}/members",
        json={"employee_public_id": emp_pid, "role_in_project": "Lead Developer"},
        headers=admin_headers,
    )
    assert member_res.status_code == 200

    # 5. List Projects
    list_res = client.get("/projects?status=active", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 6. Remove Project Member
    remove_res = client.delete(f"/projects/{proj_pid}/members/{emp_pid}", headers=admin_headers)
    assert remove_res.status_code == 200

    # 7. Delete Project
    del_res = client.delete(f"/projects/{proj_pid}", headers=admin_headers)
    assert del_res.status_code == 200
