import sys
from pathlib import Path

# Add src to sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models.user import User, Role, UserRole
from models.leave import LeaveRequest, EmployeeLeaveBalance
from core import security

client = TestClient(app)

def run_phase4_tests():
    # Setup Admin / HR Manager Auth Session linked to Employee (EMP-1001 / Rajesh Sharma)
    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.email == "rajesh.sharma@company.com").first()
        if admin_user:
            admin_user.password_hash = security.hash_password("AdminPass123!")
            admin_role = db.query(Role).filter(Role.role_name == "Admin").first()
            if admin_role:
                existing_ur = db.query(UserRole).filter(
                    UserRole.user_id == admin_user.user_id,
                    UserRole.role_id == admin_role.role_id,
                ).first()
                if not existing_ur:
                    db.add(UserRole(user_id=admin_user.user_id, role_id=admin_role.role_id))
            db.commit()

    login_res = client.post("/auth/login", json={
        "email": "rajesh.sharma@company.com",
        "password": "AdminPass123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    admin_token = login_res.json()["tokens"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Authenticated HR Admin / Manager session established")

    print("\n=== 1. Testing Holiday Calendar API ===")
    holidays_res = client.get("/holidays")
    assert holidays_res.status_code == 200, f"Get holidays failed: {holidays_res.text}"
    print(f"[PASS] Retrieved holidays list (total={holidays_res.json()['total']})")

    # Create Holiday
    new_holiday_payload = {
        "name": "Founders Day",
        "date": "2026-10-15",
        "holiday_type": "company",
        "year": 2026,
        "is_optional": False,
        "applicable_region": "ALL"
    }
    create_hol_res = client.post("/holidays", json=new_holiday_payload, headers=admin_headers)
    assert create_hol_res.status_code == 201, f"Create holiday failed: {create_hol_res.text}"
    hol_created = create_hol_res.json()
    hol_uuid = hol_created["public_id"]
    print(f"[PASS] Created company holiday: {hol_created['name']} ({hol_created['date']})")

    # Delete Holiday
    del_hol_res = client.delete(f"/holidays/{hol_uuid}", headers=admin_headers)
    assert del_hol_res.status_code == 200
    print("[PASS] Deleted holiday successfully")


    print("\n=== 2. Testing Leave Types API ===")
    ltypes_res = client.get("/leaves/types")
    assert ltypes_res.status_code == 200, f"Get leave types failed: {ltypes_res.text}"
    leave_types = ltypes_res.json()
    print(f"[PASS] Found {len(leave_types)} leave types in system")
    assert len(leave_types) >= 8, "Expected 8 default seed leave types in DB"

    casual_leave = next(lt for lt in leave_types if lt["name"] == "Casual Leave")
    casual_leave_uuid = casual_leave["public_id"]


    print("\n=== 3. Testing Leave Quota Allocation ===")
    # Pick a team member employee (e.g. employee 2, Vijay Ram)
    emp_res = client.get("/employees?limit=5", headers=admin_headers)
    employees = emp_res.json()["items"]
    emp_target = employees[1]
    emp_target_uuid = emp_target["public_id"]

    # Reset any prior test balance for clean idempotency
    with SessionLocal() as db:
        existing_bals = db.query(EmployeeLeaveBalance).all()
        for b in existing_bals:
            if b.employee and str(b.employee.public_id) == emp_target_uuid:
                b.used_leaves = 0
        db.commit()

    alloc_payload = {
        "employee_public_id": emp_target_uuid,
        "leave_type_public_id": casual_leave_uuid,
        "year": 2026,
        "total_allocated": 12
    }
    alloc_res = client.post("/leaves/allocate", json=alloc_payload, headers=admin_headers)
    assert alloc_res.status_code == 200, f"Allocate failed: {alloc_res.text}"
    alloc_data = alloc_res.json()
    assert alloc_data["total_allocated"] == 12
    assert alloc_data["remaining_leaves"] == 12
    print(f"[PASS] Allocated 12 days Casual Leave to employee {emp_target['first_name']} {emp_target['last_name']}")

    # Check balances endpoint
    bal_res = client.get(f"/leaves/balances/{emp_target_uuid}?year=2026")
    assert bal_res.status_code == 200
    balances = bal_res.json()
    emp_casual_bal = next(b for b in balances if b["leave_type_public_id"] == casual_leave_uuid)
    assert emp_casual_bal["remaining_leaves"] == 12
    print(f"[PASS] Verified leave balances: total=12, used=0, remaining=12")


    print("\n=== 4. Testing Leave Request Submission & Automatic Balance Checks ===")
    leave_req_payload = {
        "employee_public_id": emp_target_uuid,
        "leave_type_public_id": casual_leave_uuid,
        "start_date": "2026-09-10",
        "end_date": "2026-09-12",
        "total_days": 3.0,
        "reason": "Family vacation"
    }
    req_res = client.post("/leaves/requests", json=leave_req_payload, headers=admin_headers)
    assert req_res.status_code == 201, f"Leave submission failed: {req_res.text}"
    req_data = req_res.json()
    leave_uuid = req_data["public_id"]
    assert req_data["status"] == "pending"
    print(f"[PASS] Submitted leave request: public_id={leave_uuid}, status=pending, days={req_data['total_days']}")

    # Verify Detail and History Trail
    detail_res = client.get(f"/leaves/requests/{leave_uuid}")
    assert detail_res.status_code == 200
    assert len(detail_res.json()["history"]) >= 1
    assert detail_res.json()["history"][0]["action"] == "submitted"
    print(f"[PASS] Audit trail logged initial 'submitted' action")


    print("\n=== 5. Testing Manager Leave Approval & Balance Deduction ===")
    # Approve leave as Manager (Rajesh Sharma approving Vijay Ram)
    action_payload = {
        "action": "approved",
        "remarks": "Approved by Manager - enjoy your leave!"
    }
    approve_res = client.post(f"/leaves/requests/{leave_uuid}/action", json=action_payload, headers=admin_headers)
    assert approve_res.status_code == 200, f"Approval failed: {approve_res.text}"
    approved_data = approve_res.json()
    assert approved_data["status"] == "approved"
    print(f"[PASS] Leave request approved: status=approved")

    # Verify Balance Deduction
    bal_after = client.get(f"/leaves/balances/{emp_target_uuid}?year=2026").json()
    casual_after = next(b for b in bal_after if b["leave_type_public_id"] == casual_leave_uuid)
    assert casual_after["used_leaves"] == 3
    assert casual_after["remaining_leaves"] == 9
    print(f"[PASS] Leave balance automatically deducted: used=3, remaining=9")


    print("\n=== 6. Testing Leave Cancellation & Balance Refund ===")
    cancel_res = client.post(f"/leaves/requests/{leave_uuid}/cancel", headers=admin_headers)
    assert cancel_res.status_code == 200, f"Cancel failed: {cancel_res.text}"
    cancelled_data = cancel_res.json()
    assert cancelled_data["status"] == "cancelled"
    print(f"[PASS] Leave request cancelled: status=cancelled")

    # Verify Balance Refund
    bal_refunded = client.get(f"/leaves/balances/{emp_target_uuid}?year=2026").json()
    casual_refunded = next(b for b in bal_refunded if b["leave_type_public_id"] == casual_leave_uuid)
    assert casual_refunded["used_leaves"] == 0
    assert casual_refunded["remaining_leaves"] == 12
    print(f"[PASS] Leave balance automatically refunded upon cancellation: used=0, remaining=12")

    # Clean up test leave request
    with SessionLocal() as db:
        req_to_del = db.query(LeaveRequest).filter(LeaveRequest.public_id == leave_uuid).first()
        if req_to_del:
            db.delete(req_to_del)
            db.commit()
    print("[PASS] Test leave request cleaned up from database")

    print("\n ALL PHASE 4 TIME, ATTENDANCE & LEAVE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_phase4_tests()
