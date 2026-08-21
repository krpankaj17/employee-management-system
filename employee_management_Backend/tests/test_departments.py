import uuid
import pytest
from fastapi.testclient import TestClient


def test_department_crud_flow(client: TestClient, admin_headers):
    suffix = uuid.uuid4().hex[:4].upper()
    dept_name = f"Engineering-{suffix}"
    dept_code = f"ENG{suffix}"

    # 1. Create Department
    create_res = client.post(
        "/departments",
        json={"dept_name": dept_name, "dept_code": dept_code, "description": "Core product engineering"},
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    dept_data = create_res.json()
    dept_pid = dept_data["public_id"]
    assert dept_data["dept_name"] == dept_name

    # 2. Validation: Duplicate department code rejected
    dup_res = client.post(
        "/departments",
        json={"dept_name": f"Other-{suffix}", "dept_code": dept_code, "description": "Duplicate code"},
        headers=admin_headers,
    )
    assert dup_res.status_code == 409

    # 3. Get Department by UUID
    get_res = client.get(f"/departments/{dept_pid}", headers=admin_headers)
    assert get_res.status_code == 200
    assert get_res.json()["dept_name"] == dept_name

    # 4. Update Department
    updated_name = f"{dept_name}-Updated"
    update_res = client.put(
        f"/departments/{dept_pid}",
        json={"dept_name": updated_name, "dept_code": dept_code, "description": "Updated description"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["dept_name"] == updated_name

    # 5. List Departments
    list_res = client.get("/departments", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 6. Delete Department
    del_res = client.delete(f"/departments/{dept_pid}", headers=admin_headers)
    assert del_res.status_code in (200, 204)


def test_designation_crud_flow(client: TestClient, admin_headers):
    title = f"Staff Engineer-{uuid.uuid4().hex[:6]}"
    # 1. Create Designation
    create_res = client.post(
        "/designations",
        json={"title": title, "grade_level": "L5", "description": "Tech leader"},
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    desig_data = create_res.json()
    desig_pid = desig_data["public_id"]
    assert desig_data["title"] == title

    # 2. Validation: Duplicate designation title rejected
    dup_desig = client.post(
        "/designations",
        json={"title": title, "grade_level": "L6"},
        headers=admin_headers,
    )
    assert dup_desig.status_code == 409

    # 3. Get Designation by UUID
    get_res = client.get(f"/designations/{desig_pid}", headers=admin_headers)
    assert get_res.status_code == 200

    # 4. Update Designation
    update_res = client.put(
        f"/designations/{desig_pid}",
        json={"title": f"{title}-Senior", "grade_level": "L6", "description": "Senior Tech Leader"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200

    # 5. List Designations
    list_res = client.get("/designations", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 6. Delete Designation
    del_res = client.delete(f"/designations/{desig_pid}", headers=admin_headers)
    assert del_res.status_code in (200, 204)

