import sys
from pathlib import Path

src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models.user import User, Role, UserRole
from models.employee import Employee
from models.designation import Designation
from models.department import Department
from models.address import Address, EmployeeAddress
from core import security

client = TestClient(app)

def run_phase3_tests():
    # Setup Admin Auth Token
    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.email == "admin.tester@company.com").first()
        if not admin_user:
            admin_user = User(
                email="admin.tester@company.com",
                display_name="Admin Tester",
                password_hash=security.hash_password("AdminPass123!")
            )
            db.add(admin_user)
            db.flush()
            admin_role = db.query(Role).filter(Role.role_name == "Admin").first()
            if admin_role:
                db.add(UserRole(user_id=admin_user.user_id, role_id=admin_role.role_id))
            db.commit()

    login_res = client.post("/auth/login", json={
        "email": "admin.tester@company.com",
        "password": "AdminPass123!"
    })
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    admin_token = login_res.json()["tokens"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Authenticated Admin session established")

    print("\n=== 1. Testing Designations API ===")
    res_desigs = client.get("/designations")
    assert res_desigs.status_code == 200, f"Get designations failed: {res_desigs.text}"
    desig_data = res_desigs.json()
    print(f"[PASS] Total designations found: {desig_data['total']}")
    assert desig_data['total'] >= 18, "Expected default seed designations in DB"

    # Create new designation (with Admin Bearer auth)
    new_desig_payload = {
        "title": "Principal AI Architect",
        "grade_level": "L7",
        "description": "Leads core AI/ML initiatives"
    }
    create_desig_res = client.post("/designations", json=new_desig_payload, headers=admin_headers)
    assert create_desig_res.status_code == 201, f"Create desig failed: {create_desig_res.text}"
    desig_created = create_desig_res.json()
    desig_uuid = desig_created["public_id"]
    print(f"[PASS] Created designation: {desig_created['title']} (public_id={desig_uuid})")

    # Get by UUID
    get_desig_res = client.get(f"/designations/{desig_uuid}")
    assert get_desig_res.status_code == 200
    assert get_desig_res.json()["title"] == "Principal AI Architect"

    # Update designation (with Admin Bearer auth)
    update_desig_res = client.put(f"/designations/{desig_uuid}", json={
        "title": "Chief AI Architect",
        "grade_level": "L8",
        "description": "Executive AI Leadership"
    }, headers=admin_headers)
    assert update_desig_res.status_code == 200
    assert update_desig_res.json()["title"] == "Chief AI Architect"
    print(f"[PASS] Updated designation title to: {update_desig_res.json()['title']}")

    # Delete designation (with Admin Bearer auth)
    del_desig_res = client.delete(f"/designations/{desig_uuid}", headers=admin_headers)
    assert del_desig_res.status_code == 200
    print("[PASS] Deleted designation successfully")


    print("\n=== 2. Testing Departments API ===")
    res_depts = client.get("/departments")
    assert res_depts.status_code == 200, f"Get departments failed: {res_depts.text}"
    dept_data = res_depts.json()
    print(f"[PASS] Total departments found: {dept_data['total']}")

    # Find an employee UUID for department head
    emp_res = client.get("/employees?limit=1", headers=admin_headers)
    first_emp = emp_res.json()["items"][0]
    head_uuid = first_emp["public_id"]

    # Create new department (with Admin Bearer auth)
    new_dept_payload = {
        "dept_name": "Autonomous Systems",
        "dept_code": "AUTO",
        "description": "R&D for Autonomous AI Agents",
        "head_employee_public_id": head_uuid
    }
    create_dept_res = client.post("/departments", json=new_dept_payload, headers=admin_headers)
    assert create_dept_res.status_code == 201, f"Create dept failed: {create_dept_res.text}"
    dept_created = create_dept_res.json()
    dept_uuid = dept_created["public_id"]
    print(f"[PASS] Created department: {dept_created['dept_name']} ({dept_created['dept_code']}) with head_uuid={head_uuid}")

    # Get department roster
    roster_res = client.get(f"/departments/{dept_uuid}/employees")
    assert roster_res.status_code == 200
    print(f"[PASS] Department roster retrieved: {roster_res.json()['total']} employees")

    # Update department (with Admin Bearer auth)
    update_dept_res = client.put(f"/departments/{dept_uuid}", json={
        "dept_name": "Autonomous Systems & Robotics",
        "dept_code": "ROBO",
        "description": "Updated R&D Scope"
    }, headers=admin_headers)
    assert update_dept_res.status_code == 200
    assert update_dept_res.json()["dept_code"] == "ROBO"
    print(f"[PASS] Updated department code to: {update_dept_res.json()['dept_code']}")

    # Delete department (with Admin Bearer auth)
    del_dept_res = client.delete(f"/departments/{dept_uuid}", headers=admin_headers)
    assert del_dept_res.status_code == 200
    print("[PASS] Deleted department successfully")


    print("\n=== 3. Testing Addresses & Emergency Contacts API ===")
    test_emp_uuid = first_emp["public_id"]

    # Add Current Address
    addr1_payload = {
        "street_address": "120 Cyber Boulevard, Suite 400",
        "city": "Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "pincode": "560001",
        "address_type": "current",
        "is_primary": True
    }
    addr1_res = client.post(f"/employees/{test_emp_uuid}/addresses", json=addr1_payload, headers=admin_headers)
    assert addr1_res.status_code == 201, f"Add current address failed: {addr1_res.text}"
    addr1_data = addr1_res.json()
    addr1_uuid = addr1_data["public_id"]
    print(f"[PASS] Added current address: {addr1_data['formatted_address']} (is_primary={addr1_data['is_primary']})")

    # Add Permanent Address (mark primary to test automatic flag transfer)
    addr2_payload = {
        "street_address": "45 Green Park Road",
        "city": "New Delhi",
        "state": "Delhi",
        "country": "India",
        "pincode": "110016",
        "address_type": "permanent",
        "is_primary": True
    }
    addr2_res = client.post(f"/employees/{test_emp_uuid}/addresses", json=addr2_payload, headers=admin_headers)
    assert addr2_res.status_code == 201
    addr2_data = addr2_res.json()
    addr2_uuid = addr2_data["public_id"]
    print(f"[PASS] Added permanent address: {addr2_data['formatted_address']} (is_primary={addr2_data['is_primary']})")

    # Get employee addresses
    list_addr_res = client.get(f"/employees/{test_emp_uuid}/addresses", headers=admin_headers)
    assert list_addr_res.status_code == 200
    all_addrs = list_addr_res.json()
    assert len(all_addrs) == 2, f"Expected 2 addresses, got {len(all_addrs)}"
    primary_count = sum(1 for a in all_addrs if a["is_primary"])
    assert primary_count == 1, "Exactly one address should be marked is_primary=True"
    print(f"[PASS] Verified address listing: exactly 1 primary address maintained")

    # Delete address 1
    del_addr_res = client.delete(f"/employees/{test_emp_uuid}/addresses/{addr1_uuid}", headers=admin_headers)
    assert del_addr_res.status_code == 200
    print("[PASS] Deleted address 1 successfully")

    # Add Emergency Contact
    contact_payload = {
        "contact_name": "Elena Sharma",
        "relationship": "Spouse",
        "phone": "9811122233",
        "email": "elena.sharma@gmail.com",
        "is_primary": True
    }
    contact_res = client.post(f"/employees/{test_emp_uuid}/emergency-contacts", json=contact_payload, headers=admin_headers)
    assert contact_res.status_code == 201, f"Add contact failed: {contact_res.text}"
    contact_data = contact_res.json()
    contact_id = contact_data["contact_id"]
    print(f"[PASS] Added emergency contact: {contact_data['contact_name']} ({contact_data['relationship']})")

    # Get emergency contacts
    get_contacts_res = client.get(f"/employees/{test_emp_uuid}/emergency-contacts", headers=admin_headers)
    assert get_contacts_res.status_code == 200
    assert len(get_contacts_res.json()) >= 1
    print(f"[PASS] Verified emergency contact listing")

    # Delete emergency contact
    del_contact_res = client.delete(f"/employees/{test_emp_uuid}/emergency-contacts/{contact_id}", headers=admin_headers)
    assert del_contact_res.status_code == 200
    print("[PASS] Deleted emergency contact successfully")

    # Clean up address 2
    client.delete(f"/employees/{test_emp_uuid}/addresses/{addr2_uuid}", headers=admin_headers)
    print("[PASS] Cleaned up test address 2")

    # Clean up Admin tester user
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "admin.tester@company.com").first()
        if u:
            db.delete(u)
            db.commit()
    print("[PASS] Cleaned up Admin tester account")

    print("\n ALL PHASE 3 CORE HR TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_phase3_tests()
