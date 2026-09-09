import uuid
import pytest
from fastapi.testclient import TestClient


def test_list_and_search_employees(client: TestClient, admin_headers):
    # 1. Search employees with pagination
    res = client.get("/employees/search?skip=0&limit=10", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    # 2. Search employees by status
    search_res = client.get("/employees/search?employee_status=active", headers=admin_headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "items" in search_data


def test_employee_crud_and_addresses(client: TestClient, admin_headers):
    suffix = uuid.uuid4().hex[:6]
    email = f"john.doe.{suffix}@company.com"
    phone = f"+91{uuid.uuid4().int % 10000000000:010d}"

    # 1. User signs up and Admin assigns role -> Auto-provisions Employee
    signup_res = client.post(
        "/auth/signup",
        json={"email": email, "display_name": f"John Doe-{suffix}", "password": "Password123!"},
    )
    assert signup_res.status_code == 201
    user_pid = signup_res.json()["user"]["public_id"]

    assign_res = client.post(
        f"/auth/users/{user_pid}/roles",
        json={"role_names": ["Employee"]},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    emp_pid = assign_res.json()["employee_public_id"]
    assert emp_pid is not None

    # 2. Lookup Employee via search by public_id
    get_res = client.get(f"/employees/search?public_id={emp_pid}", headers=admin_headers)
    assert get_res.status_code == 200
    items = get_res.json()["items"]
    assert len(items) == 1
    emp_data = items[0]
    assert emp_data["public_id"] == emp_pid
    emp_code = emp_data["employee_code"]

    # 3. Lookup Employee via search by email
    email_res = client.get(f"/employees/search?email={email}", headers=admin_headers)
    assert email_res.status_code == 200
    email_items = email_res.json()["items"]
    assert len(email_items) == 1
    assert email_items[0]["public_id"] == emp_pid

    # 4. Lookup Employee via search by code
    code_res = client.get(f"/employees/search?employee_code={emp_code}", headers=admin_headers)
    assert code_res.status_code == 200
    code_items = code_res.json()["items"]
    assert len(code_items) == 1
    assert code_items[0]["public_id"] == emp_pid

    # 5. Update Employee
    update_payload = {
        "first_name": "John",
        "last_name": f"Doe-Updated-{suffix}",
        "date_of_birth": "1995-05-15",
        "gender": "male",
        "email": email,
        "phone": phone,
        "joining_date": "2023-01-10",
        "employee_status": "active",
        "employment_type": "full_time",
        "is_active": True,
    }
    update_res = client.put(f"/employees/{emp_pid}", json=update_payload, headers=admin_headers)
    assert update_res.status_code == 200
    assert update_res.json()["last_name"] == f"Doe-Updated-{suffix}"

    # 6. Add Address
    addr_payload = {
        "address_type": "current",
        "street_address": "123 Tech Park",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "pincode": "560001",
        "is_primary": True,
    }
    addr_res = client.post(f"/employees/{emp_pid}/addresses", json=addr_payload, headers=admin_headers)
    assert addr_res.status_code in (200, 201)

    # 7. Add Emergency Contact
    contact_payload = {
        "contact_name": "Jane Doe",
        "relationship": "Spouse",
        "phone": "+919876543210",
        "is_primary": True,
    }
    contact_res = client.post(
        f"/employees/{emp_pid}/emergency-contacts",
        json=contact_payload,
        headers=admin_headers,
    )
    assert contact_res.status_code in (200, 201)

    # 8. Delete / Deactivate Employee
    del_res = client.delete(f"/employees/{emp_pid}", headers=admin_headers)
    assert del_res.status_code in (200, 204)


def test_get_my_employee_profile_endpoint(
    client: TestClient,
    employee_headers,
    employee_auth,
    plain_headers,
):
    # 1. Authenticated employee can fetch own profile via /employees/me
    me_res = client.get("/employees/me", headers=employee_headers)
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["public_id"] == employee_auth["employee_public_id"]
    assert data["first_name"] == "Employee"

    # 2. User without employee profile receives 404
    plain_res = client.get("/employees/me", headers=plain_headers)
    assert plain_res.status_code == 404


def test_employee_self_service_onboarding_and_update(client: TestClient, admin_headers):
    # 1. User signs up and Admin assigns Employee role
    suffix = uuid.uuid4().hex[:6]
    signup_res = client.post(
        "/auth/signup",
        json={
            "email": f"new.joiner.{suffix}@company.com",
            "password": "SecurePassword123!",
            "display_name": "New Joiner",
        },
    )
    assert signup_res.status_code == 201
    user_pid = signup_res.json()["user"]["public_id"]
    token = signup_res.json()["tokens"]["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}

    assign_res = client.post(
        f"/auth/users/{user_pid}/roles",
        json={"role_names": ["Employee"]},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200

    # 2. Onboarding: Submit personal info, address, and emergency contact in one single payload via PUT /employees/me
    onboard_payload = {
        "first_name": "New",
        "last_name": f"Joiner-{suffix}",
        "date_of_birth": "1996-08-20",
        "gender": "female",
        "phone": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "secondary_email": f"personal.{suffix}@gmail.com",
        "addresses": [
            {
                "address_type": "current",
                "street_address": "402 Silicon Heights, MG Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "country": "India",
                "pincode": "560001",
                "is_primary": True,
            }
        ],
        "emergency_contacts": [
            {
                "contact_name": "Parent Name",
                "relationship": "Parent",
                "phone": "+919876543299",
                "email": "parent@example.com",
                "is_primary": True,
            }
        ],
    }

    onboard_res = client.put("/employees/me", json=onboard_payload, headers=user_headers)
    assert onboard_res.status_code == 200
    profile = onboard_res.json()
    assert profile["first_name"] == "New"
    assert profile["last_name"] == f"Joiner-{suffix}"
    assert len(profile["addresses"]) >= 1
    assert profile["addresses"][0]["city"] == "Bengaluru"
    assert profile["emergency_contacts"][0]["relationship"] == "Parent"

    # 3. GET /employees/me returns the complete profile
    me_res = client.get("/employees/me", headers=user_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["employee_code"].startswith("EMP-")
    assert me_data["email"] == f"new.joiner.{suffix}@company.com"
    assert len(me_data["addresses"]) >= 1
    assert len(me_data["emergency_contacts"]) >= 1

    # 4. PUT /employees/me updates personal information
    onboard_payload["first_name"] = "UpdatedName"
    put_res = client.put("/employees/me", json=onboard_payload, headers=user_headers)
    assert put_res.status_code == 200
    assert put_res.json()["first_name"] == "UpdatedName"


def test_admin_employee_composite_setup(client: TestClient, admin_headers):
    # 1. User signs up
    suffix = uuid.uuid4().hex[:6]
    unique_email = f"emp.setup.{suffix}@company.com"
    signup_res = client.post(
        "/auth/signup",
        json={"email": unique_email, "display_name": f"Corporate Hire {suffix}", "password": "Password123!"},
    )
    assert signup_res.status_code == 201
    user_pid = signup_res.json()["user"]["public_id"]

    # 2. Admin assigns role -> auto-provisions Employee
    assign_res = client.post(
        f"/auth/users/{user_pid}/roles",
        json={"role_names": ["Employee"]},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    emp_pid = assign_res.json()["employee_public_id"]
    assert emp_pid is not None

    # 3. Fetch a department and designation
    dept_res = client.get("/departments", headers=admin_headers)
    assert dept_res.status_code == 200
    dept_items = dept_res.json().get("items", [])
    dept_pid = dept_items[0]["public_id"] if dept_items else None

    desig_res = client.get("/designations", headers=admin_headers)
    assert desig_res.status_code == 200
    desig_items = desig_res.json().get("items", [])
    desig_pid = desig_items[0]["public_id"] if desig_items else None

    # 4. Admin single composite setup API call
    setup_payload = {
        "department_public_id": dept_pid,
        "designation_public_id": desig_pid,
        "joining_date": "2024-03-01",
        "employee_status": "active",
        "employment_type": "full_time",
        "phone": f"+91{uuid.uuid4().int % 10000000000:010d}",
        "bank_name": "HDFC Bank",
        "branch_name": "Koramangala",
        "account_number": f"987654{suffix}",
        "routing_code": "HDFC0001234",
        "account_type": "savings",
        "basic_salary": 75000.0,
        "net_salary": 70000.0,
        "currency": "INR",
        "addresses": [
            {
                "address_type": "permanent",
                "street_address": "77 Corporate Blvd",
                "city": "Mumbai",
                "state": "Maharashtra",
                "country": "India",
                "pincode": "400001",
                "is_primary": True,
            }
        ],
    }

    setup_res = client.put(f"/employees/{emp_pid}/admin-setup", json=setup_payload, headers=admin_headers)
    assert setup_res.status_code == 200
    data = setup_res.json()
    assert data["public_id"] == emp_pid
    assert data["employee_status"] == "active"
    assert data["employment_type"] == "full_time"
    assert data["joining_date"] == "2024-03-01"
    assert len(data["addresses"]) >= 1
    assert data["addresses"][0]["city"] == "Mumbai"
    assert "created_at" not in data
    assert "updated_at" not in data


def test_consolidated_search_filters_and_removed_endpoints(client: TestClient, admin_headers):
    # 1. Search by exact email
    res_email = client.get("/employees/search?email=test.admin@company.com", headers=admin_headers)
    assert res_email.status_code == 200
    assert len(res_email.json()["items"]) >= 1
    assert res_email.json()["items"][0]["email"] == "test.admin@company.com"

    # 2. Search by non-existent filter returns 0 items
    res_none = client.get("/employees/search?employee_code=NON_EXISTENT_CODE", headers=admin_headers)
    assert res_none.status_code == 200
    assert res_none.json()["total"] == 0
    assert res_none.json()["items"] == []

    # 3. Verify removed endpoints return 404 or 405
    res_root = client.get("/employees", headers=admin_headers)
    assert res_root.status_code in (404, 405)

    res_by_email = client.get("/employees/by-email/test.admin@company.com", headers=admin_headers)
    assert res_by_email.status_code in (404, 405)

    res_by_code = client.get("/employees/by-code/EMP-1001", headers=admin_headers)
    assert res_by_code.status_code in (404, 405)

    res_reports = client.get(f"/employees/{str(uuid.uuid4())}/reports", headers=admin_headers)
    assert res_reports.status_code in (404, 405)

    res_pid_direct = client.get(f"/employees/{str(uuid.uuid4())}", headers=admin_headers)
    assert res_pid_direct.status_code in (404, 405)

    # 4. Verify removed POST employee endpoints return 404 or 405
    res_post_emp = client.post("/employees", json={}, headers=admin_headers)
    assert res_post_emp.status_code in (404, 405, 422)

    res_post_me = client.post("/employees/me", json={}, headers=admin_headers)
    assert res_post_me.status_code in (404, 405)

    res_post_onboard = client.post("/employees/me/onboard", json={}, headers=admin_headers)
    assert res_post_onboard.status_code in (404, 405)


