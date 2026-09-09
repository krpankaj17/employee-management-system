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


def test_employee_department_access_controls(
    client: TestClient,
    employee_headers,
    hr_headers,
    admin_headers,
):
    # 1. Regular employee CANNOT list all departments
    res_list = client.get("/departments", headers=employee_headers)
    assert res_list.status_code == 403

    # 2. HR and Admin CAN list all departments
    res_hr_list = client.get("/departments", headers=hr_headers)
    assert res_hr_list.status_code == 200
    assert res_hr_list.json()["total"] >= 1

    res_admin_list = client.get("/departments", headers=admin_headers)
    assert res_admin_list.status_code == 200
    all_depts = res_admin_list.json()["items"]
    assert len(all_depts) >= 1

    # 3. Regular employee CAN access their own department via /departments/me
    res_me = client.get("/departments/me", headers=employee_headers)
    assert res_me.status_code == 200
    my_dept = res_me.json()
    my_dept_pid = my_dept["public_id"]
    assert my_dept["dept_code"] in ("DEPT-2", "ENG")

    # 4. Regular employee CAN view their own department's employees via /departments/me/employees
    res_me_emps = client.get("/departments/me/employees", headers=employee_headers)
    assert res_me_emps.status_code == 200
    assert res_me_emps.json()["total"] >= 1
    assert res_me_emps.json()["department_public_id"] == my_dept_pid

    # 5. Regular employee CAN view their own department by UUID
    res_own_dept = client.get(f"/departments/{my_dept_pid}", headers=employee_headers)
    assert res_own_dept.status_code == 200
    assert res_own_dept.json()["public_id"] == my_dept_pid

    # 6. Regular employee CAN view their own department employees by UUID
    res_own_dept_emps = client.get(f"/departments/{my_dept_pid}/employees", headers=employee_headers)
    assert res_own_dept_emps.status_code == 200

    # 7. Find another department (e.g. HR or Executive or Sales)
    other_dept = next(d for d in all_depts if d["public_id"] != my_dept_pid)
    other_dept_pid = other_dept["public_id"]

    # Regular employee CANNOT view another department by UUID
    res_other_dept = client.get(f"/departments/{other_dept_pid}", headers=employee_headers)
    assert res_other_dept.status_code == 403

    # Regular employee CANNOT view another department's employee roster
    res_other_dept_emps = client.get(f"/departments/{other_dept_pid}/employees", headers=employee_headers)
    assert res_other_dept_emps.status_code == 403

    # 8. HR Manager CAN view other department and its employees
    res_hr_view_other = client.get(f"/departments/{other_dept_pid}", headers=hr_headers)
    assert res_hr_view_other.status_code == 200

    res_hr_view_other_emps = client.get(f"/departments/{other_dept_pid}/employees", headers=hr_headers)
    assert res_hr_view_other_emps.status_code == 200


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

