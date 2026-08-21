import uuid
import pytest
from fastapi.testclient import TestClient


def test_auth_signup_success(client: TestClient):
    unique_email = f"signup.{uuid.uuid4().hex[:8]}@company.com"
    payload = {
        "email": unique_email,
        "display_name": "New Test User",
        "password": "Password123!",
        "secondary_email": f"backup.{uuid.uuid4().hex[:8]}@gmail.com",
    }
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["ok"] is True
    assert "tokens" in data
    assert "user" in data
    assert data["user"]["email"] == unique_email
    assert "Employee" in data["user"]["roles"]


def test_auth_signup_duplicate_email(client: TestClient):
    unique_email = f"dup.{uuid.uuid4().hex[:8]}@company.com"
    payload = {
        "email": unique_email,
        "display_name": "Duplicate User",
        "password": "Password123!",
    }
    res1 = client.post("/auth/signup", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/auth/signup", json=payload)
    assert res2.status_code == 409

    # Invalid email format check
    invalid_email_res = client.post(
        "/auth/signup",
        json={"email": "not-a-valid-email", "display_name": "Bad Email", "password": "Password123!"},
    )
    assert invalid_email_res.status_code in (400, 422)


def test_auth_login_success(client: TestClient, admin_auth):
    res = client.post(
        "/auth/login",
        json={"email": "test.admin@company.com", "password": "TestPass123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "tokens" in data
    assert "access_token" in data["tokens"]
    assert "refresh_token" in data["tokens"]


def test_auth_login_invalid_password(client: TestClient, admin_auth):
    # Wrong password
    res1 = client.post(
        "/auth/login",
        json={"email": "test.admin@company.com", "password": "WrongPassword!"},
    )
    assert res1.status_code == 401

    # Non-existent user
    res2 = client.post(
        "/auth/login",
        json={"email": "nonexistent.user@company.com", "password": "TestPass123!"},
    )
    assert res2.status_code == 401



def test_auth_refresh_token(client: TestClient, admin_auth):
    # Log in to get a fresh refresh token
    login_res = client.post(
        "/auth/login",
        json={"email": "test.admin@company.com", "password": "TestPass123!"},
    )
    assert login_res.status_code == 200
    refresh_token = login_res.json()["tokens"]["refresh_token"]

    # Use the refresh token
    refresh_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert "access_token" in data
    assert "token_type" in data


def test_auth_me_authenticated(client: TestClient, admin_headers):
    res = client.get("/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test.admin@company.com"
    assert "Admin" in data["roles"]
    assert len(data["permissions"]) > 0


def test_auth_roles_and_permissions(client: TestClient, admin_headers):
    roles_res = client.get("/auth/roles", headers=admin_headers)
    assert roles_res.status_code == 200
    roles = roles_res.json()
    assert isinstance(roles, list)
    role_names = [r["role_name"] for r in roles]
    assert "Admin" in role_names
    assert "Employee" in role_names

    perms_res = client.get("/auth/permissions", headers=admin_headers)
    assert perms_res.status_code == 200
    perms = perms_res.json()
    assert isinstance(perms, list)
    assert len(perms) > 10
