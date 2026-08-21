import uuid
import pytest
from fastapi.testclient import TestClient


def test_list_and_search_employees(client: TestClient, admin_headers):
    # 1. List employees
    res = client.get("/employees?skip=0&limit=10", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    # 2. Search employees
    search_res = client.get("/employees/search?employee_status=active", headers=admin_headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "items" in search_data


def test_employee_crud_and_addresses(client: TestClient, admin_headers):
    suffix = uuid.uuid4().hex[:6]
    email = f"john.doe.{suffix}@company.com"
    phone = f"+91{uuid.uuid4().int % 10000000000:010d}"

    # 1. Create Employee
    payload = {
        "first_name": "John",
        "last_name": f"Doe-{suffix}",
        "date_of_birth": "1995-05-15",
        "gender": "male",
        "email": email,
        "phone": phone,
        "joining_date": "2023-01-10",
        "employee_status": "active",
        "employment_type": "full_time",
        "is_active": True,
    }
    create_res = client.post("/employees", json=payload, headers=admin_headers)
    assert create_res.status_code == 201
    emp_data = create_res.json()
    emp_pid = emp_data["public_id"]
    emp_code = emp_data["employee_code"]
    assert emp_data["email"] == email

    # 2. Validation: Duplicate employee email rejected
    dup_res = client.post("/employees", json=payload, headers=admin_headers)
    assert dup_res.status_code in (400, 409)


    # 3. Get Employee by UUID
    get_res = client.get(f"/employees/{emp_pid}", headers=admin_headers)

    assert get_res.status_code == 200
    assert get_res.json()["public_id"] == emp_pid

    # 3. Get Employee by Email
    email_res = client.get(f"/employees/by-email/{email}", headers=admin_headers)
    assert email_res.status_code == 200
    assert email_res.json()["public_id"] == emp_pid

    # 4. Get Employee by Code
    code_res = client.get(f"/employees/by-code/{emp_code}", headers=admin_headers)
    assert code_res.status_code == 200
    assert code_res.json()["public_id"] == emp_pid

    # 5. Update Employee
    update_payload = dict(payload)
    update_payload["last_name"] = f"Doe-Updated-{suffix}"
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
