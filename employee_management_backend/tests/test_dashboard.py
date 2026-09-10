# tests/test_dashboard.py
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models.user import User
from core.security import create_access_token

client = TestClient(app)

def test_dashboard_summary_authenticated():
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == "admin@company.com").first()
        if not user:
            user = db.query(User).first()
        token = create_access_token({
            "sub": str(user.public_id),
            "email": user.email,
            "roles": ["Admin"],
            "permissions": ["*"]
        })

    response = client.get("/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "metrics" in data
    assert "total_employees" in data["metrics"]
    assert "weekly_attendance" in data
    assert len(data["weekly_attendance"]) == 5
    assert "recent_projects" in data
    assert "recent_announcements" in data


def test_dashboard_summary_unauthenticated():
    response = client.get("/dashboard/summary")
    assert response.status_code == 401
