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
    ann_list = list_res.json()
    assert isinstance(ann_list, list)

    # 3. Delete Announcement
    del_res = client.delete(f"/announcements/{ann_pid}", headers=admin_headers)
    assert del_res.status_code == 200
