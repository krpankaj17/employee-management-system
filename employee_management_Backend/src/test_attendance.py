import sys
import datetime
from pathlib import Path

# Add src to sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(src_dir))

from fastapi.testclient import TestClient
from main import app
import services

client = TestClient(app)

def run_tests():
    print("=== Testing FastAPI App Initialization ===")
    res = client.get("/")
    assert res.status_code == 200, f"Root failed: {res.text}"
    print("[PASS] Root health check OK:", res.json())

    print("\n=== Testing Live Server-Authoritative Employee Check-In ===")
    # Employee 5 check-in: NO date or time passed from client!
    checkin_payload = {
        "employee_id": 5,
        "work_mode": "in_office",
        "notes": "Automated test morning check-in"
    }
    res = client.post("/attendance/check-in", json=checkin_payload)
    assert res.status_code == 201, f"Check-in failed: {res.text}"
    record = res.json()
    att_id = record["id"]
    today_str = datetime.date.today().isoformat()
    assert record["employee_id"] == 5
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
    # Employee 5 check-out: NO date or time passed from client!
    checkout_payload = {
        "employee_id": 5,
        "notes": "Evening shift done"
    }
    res = client.post("/attendance/check-out", json=checkout_payload)
    assert res.status_code == 200, f"Check-out failed: {res.text}"
    out_record = res.json()
    assert out_record["check_out"] is not None
    assert out_record["date"] == today_str
    print(f"[PASS] Server stamped check-out: out={out_record['check_out']}, total_hours={out_record['total_hours']}, status={out_record['status']}")

    print("\n=== Testing Admin Override / Manual Entry for Past Date ===")
    manual_res = client.post("/attendance/record", json={
        "employee_id": 6,
        "date": "2026-08-01",
        "check_in": "10:00:00",
        "check_out": "15:00:00",
        "work_mode": "remote",
        "status": "half_day",
        "notes": "Admin backfill for Saturday"
    })
    assert manual_res.status_code == 201, f"Manual creation failed: {manual_res.text}"
    manual_id = manual_res.json()["id"]
    assert manual_res.json()["total_hours"] == 5.0

    # Clean up manual record
    client.delete(f"/attendance/{manual_id}")
    print(f"[PASS] Admin manual backfilling verified & cleaned up (id={manual_id})")

    print("\n=== Cleaning up live test record ===")
    client.delete(f"/attendance/{att_id}")
    print(f"[PASS] Cleaned up live test record id={att_id}")

    print("\n=== Testing Today's Overview Snapshot ===")
    overview_res = client.get("/attendance/today/overview")
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert "summary_counts" in overview
    print("[PASS] Today's Overview counts:", overview["summary_counts"])

    print("\n ALL SERVER-AUTHORITATIVE TESTS PASSED!")

if __name__ == "__main__":
    run_tests()
