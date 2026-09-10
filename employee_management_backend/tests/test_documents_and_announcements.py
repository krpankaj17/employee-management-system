import uuid
import pytest
from fastapi.testclient import TestClient


def test_document_registration_and_retrieval(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]

    # 1. Register Document Metadata
    doc_payload = {
        "employee_public_id": emp_pid,
        "document_type": "offer_letter",
        "document_name": "Offer_Letter_2026.pdf",
        "document_url": "https://storage.cloud.com/docs/offer_letter_123.pdf",
        "file_size_bytes": 204800,
    }
    create_res = client.post("/documents/register", json=doc_payload, headers=admin_headers)
    assert create_res.status_code == 201
    doc_data = create_res.json()
    assert doc_data["document_name"] == "Offer_Letter_2026.pdf"

    # 2. Get Employee Documents
    list_res = client.get(f"/documents/employee/{emp_pid}", headers=admin_headers)
    assert list_res.status_code == 200
    docs = list_res.json()
    assert isinstance(docs, list)
    assert len(docs) >= 1


def test_document_verification_and_self_verification(
    client: TestClient, admin_headers, admin_auth, employee_headers, employee_auth
):
    emp_pid = employee_auth["employee_public_id"]
    admin_emp_pid = admin_auth["employee_public_id"]

    # 1. Register a document for standard employee
    reg_emp_doc = client.post(
        "/documents/register",
        json={
            "employee_public_id": emp_pid,
            "document_type": "aadhaar",
            "document_name": "Aadhaar_Card_Emp.pdf",
            "document_url": "https://storage.cloud.com/docs/aadhaar_emp.pdf",
            "file_size_bytes": 102400,
        },
        headers=admin_headers,
    )
    assert reg_emp_doc.status_code == 201
    emp_doc_data = reg_emp_doc.json()
    emp_doc_pid = emp_doc_data["public_id"]
    assert emp_doc_data["status"] == "Pending_Verification"

    # 2. Check pending documents queue
    pending_res = client.get("/documents/pending", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_data = pending_res.json()
    assert "items" in pending_data and "total" in pending_data
    assert any(d["public_id"] == emp_doc_pid for d in pending_data["items"])

    # 3. Standard employee attempts to verify document -> should be 403 Forbidden
    forbidden_res = client.post(
        f"/documents/{emp_doc_pid}/verify",
        json={"status": "Verified", "verification_notes": "Attempt by non-admin"},
        headers=employee_headers,
    )
    assert forbidden_res.status_code == 403

    # 4. Admin verifies standard employee's document -> should be 200 OK
    verify_res = client.post(
        f"/documents/{emp_doc_pid}/verify",
        json={"status": "Verified", "verification_notes": "All checks passed."},
        headers=admin_headers,
    )
    assert verify_res.status_code == 200
    verified_data = verify_res.json()
    assert verified_data["status"] == "Verified"
    assert verified_data["verification_notes"] == "All checks passed."
    assert verified_data["verified_by_user_id"] is not None

    # 5. SELF-VERIFICATION: Admin registers their own document
    admin_doc_res = client.post(
        "/documents/register",
        json={
            "employee_public_id": admin_emp_pid,
            "document_type": "passport",
            "document_name": "Admin_Passport.pdf",
            "document_url": "https://storage.cloud.com/docs/admin_passport.pdf",
            "file_size_bytes": 300000,
        },
        headers=admin_headers,
    )
    assert admin_doc_res.status_code == 201
    admin_doc_pid = admin_doc_res.json()["public_id"]

    # 6. SELF-VERIFICATION: Admin verifies their own document directly
    self_verify_res = client.post(
        f"/documents/{admin_doc_pid}/verify",
        json={"status": "Verified", "verification_notes": "Self-verified by Admin"},
        headers=admin_headers,
    )
    assert self_verify_res.status_code == 200
    self_verified_data = self_verify_res.json()
    assert self_verified_data["status"] == "Verified"
    assert self_verified_data["verification_notes"] == "Self-verified by Admin"



def test_announcements_and_notifications_flow(client: TestClient, admin_headers, employee_headers):
    title = f"Townhall Meeting {uuid.uuid4().hex[:6]}"

    # 1. Post Announcement
    create_res = client.post(
        "/announcements",
        json={
            "title": title,
            "content": "All hands quarterly meeting on Friday at 4 PM.",
            "priority": "high",
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    ann_data = create_res.json()
    ann_pid = ann_data["public_id"]
    assert ann_data["title"] == title

    # 2. List Announcements as Employee
    list_res = client.get("/announcements", headers=employee_headers)
    assert list_res.status_code == 200
    ann_res = list_res.json()
    assert "items" in ann_res and isinstance(ann_res["items"], list)
    assert ann_res["total"] >= 1

    # 3. Delete Announcement
    del_res = client.delete(f"/announcements/{ann_pid}", headers=admin_headers)
    assert del_res.status_code == 200


def test_notifications_inbox_flow(client: TestClient, employee_headers, plain_headers):
    # 1. Plain user without employee profile gets [] on inbox
    plain_inbox = client.get("/announcements/notifications/inbox", headers=plain_headers)
    assert plain_inbox.status_code == 200
    assert plain_inbox.json() == []

    # 2. Employee gets list on inbox
    emp_inbox = client.get("/announcements/notifications/inbox", headers=employee_headers)
    assert emp_inbox.status_code == 200
    assert isinstance(emp_inbox.json(), list)

