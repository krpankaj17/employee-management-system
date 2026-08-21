import sys
import datetime
from pathlib import Path

# Add src to sys.path
src_dir = Path(__file__).resolve().parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models.user import User, Role, UserRole
from core import security
from repository import attendance_repository as att_repo

client = TestClient(app)

def run_tests():
    print("=== Testing FastAPI App Initialization ===")
    res = client.get("/")
    assert res.status_code == 200, f"Root failed: {res.text}"
    print("[PASS] Root health check OK:", res.json())

    # Setup Admin session
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
    admin_token = login_res.json()["tokens"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Look up employee public_ids for test employees (emp_id 5 and 6)
    all_emps = client.get("/employees?limit=100", headers=admin_headers).json()
    emp5_public_id = None
    emp6_public_id = None
    for emp in all_emps["items"]:
        if emp["employee_code"] == "EMP-1005":
            emp5_public_id = emp["public_id"]
        if emp["employee_code"] == "EMP-1006":
            emp6_public_id = emp["public_id"]
    assert emp5_public_id is not None, "Could not find employee EMP-1005"
    assert emp6_public_id is not None, "Could not find employee EMP-1006"
    print(f"[INFO] Using emp5 UUID: {emp5_public_id}, emp6 UUID: {emp6_public_id}")

    print("\n=== Testing Live Server-Authoritative Employee Check-In ===")
    # Employee 5 check-in: Uses public_id UUID, NO date or time passed from client!
    checkin_payload = {
        "employee_public_id": emp5_public_id,
        "work_mode": "in_office",
        "notes": "Automated test morning check-in"
    }
    res = client.post("/attendance/check-in", json=checkin_payload)
    assert res.status_code == 201, f"Check-in failed: {res.text}"
    record = res.json()
    att_id = record["id"]
    today_str = datetime.date.today().isoformat()
    assert record["date"] == today_str
    assert record["check_in"] is not None
    assert record["check_out"] is None
    assert record["total_hours"] == 0.0
    print(f"[PASS] Server stamped check-in (id={att_id}, date={record['date']}, in={record['check_in']}, is_late={record['is_late']})")

    print("\n=== Testing Duplicate Check-In Rejection ===")
    dup_res = client.post("/attendance/check-in", json=checkin_payload)
    assert dup_res.status_code == 409, f"Expected 409 Conflict for duplicate check-in, got {dup_res.status_code}"
    print(f"[PASS] Duplicate check-in blocked with 409: {dup_res.json()['detail']}")

    print("\n=== Testing Live Server-Authoritative Employee Check-Out ===")
    # Employee 5 check-out: Uses public_id UUID
    checkout_payload = {
        "employee_public_id": emp5_public_id,
        "notes": "Automated test evening check-out"
    }
    out_res = client.post("/attendance/check-out", json=checkout_payload)
    assert out_res.status_code == 200, f"Check-out failed: {out_res.text}"
    record_out = out_res.json()
    assert record_out["check_out"] is not None
    assert record_out["total_hours"] is not None
    print(f"[PASS] Server stamped check-out: out={record_out['check_out']}, total_hours={record_out['total_hours']}, status={record_out['status']}")

    print("\n=== Testing Admin Override / Manual Entry for Past Date ===")
    # Clean up any residual past record for test date
    for r in att_repo.get_all():
        if r.get("employee_id") == 6 and r.get("date") == "2026-08-10":
            att_repo.delete(r["id"])

    # Admin manual backfill for employee 6 on a past date
    manual_payload = {
        "employee_public_id": emp6_public_id,
        "date": "2026-08-10",
        "check_in": "09:15:00",
        "check_out": "18:00:00",
        "work_mode": "in_office",
        "status": "present",
        "notes": "Manual HR backfill for on-site client meeting"
    }
    manual_res = client.post("/attendance/records", json=manual_payload, headers=admin_headers)
    assert manual_res.status_code == 201, f"Manual insert failed: {manual_res.text}"
    m_record = manual_res.json()
    assert m_record["date"] == "2026-08-10"
    assert m_record["total_hours"] == 8.75
    manual_id = m_record["id"]

    # Delete test manual record
    del_res = client.delete(f"/attendance/records/{manual_id}", headers=admin_headers)
    assert del_res.status_code == 200
    print(f"[PASS] Admin manual backfilling verified & cleaned up (id={manual_id})")

    # Clean up the live check-in record for EMP-1005 so DB remains clean
    del_live = client.delete(f"/attendance/records/{att_id}", headers=admin_headers)
    assert del_live.status_code == 200
    print(f"[PASS] Cleaned up live test record id={att_id}")

    print("\n=== Testing Today's Overview Snapshot ===")
    overview_res = client.get("/attendance/today/overview", headers=admin_headers)
    assert overview_res.status_code == 200, f"Overview failed: {overview_res.text}"
    overview_data = overview_res.json()
    assert "summary_counts" in overview_data
    counts = overview_data["summary_counts"]
    assert "total_active_employees" in counts
    assert "checked_in_now" in counts
    assert "checked_out" in counts
    assert "on_leave" in counts
    assert "not_checked_in" in counts
    print(f"[PASS] Today's Overview counts: {counts}")

    print("\n ALL SERVER-AUTHORITATIVE TESTS PASSED!")

if __name__ == "__main__":
    run_tests()
