import uuid
import pytest
from fastapi.testclient import TestClient


def test_auth_signup_success(client: TestClient):
    unique_email = f"signup.{uuid.uuid4().hex[:8]}@company.com"
    payload = {
        "email": unique_email,
        "display_name": "New Test User",
        "password": "Password123!",
    }
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["ok"] is True
    assert "tokens" in data
    assert "user" in data
    assert data["user"]["email"] == unique_email
    # Newly registered user has no roles until admin approval/role assignment
    assert data["user"]["roles"] == []
    assert data["user"]["employee_public_id"] is None
    assert "created_at" not in data["user"]
    assert "updated_at" not in data["user"]


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
    assert "created_at" not in data
    assert "updated_at" not in data


def test_auth_roles_and_permissions(client: TestClient, admin_headers):
    roles_res = client.get("/auth/roles", headers=admin_headers)
    assert roles_res.status_code == 200
    roles = roles_res.json()
    assert isinstance(roles, list)
    role_names = [r["role_name"] for r in roles]
    assert "Admin" in role_names
    assert "Employee" in role_names
    if len(roles) > 0:
        assert "created_at" not in roles[0]

    perms_res = client.get("/auth/permissions", headers=admin_headers)
    assert perms_res.status_code == 200
    perms = perms_res.json()
    assert isinstance(perms, list)
    assert len(perms) > 10


def test_get_all_users_authenticated_admin(client: TestClient, admin_headers):
    res = client.get("/auth/users", headers=admin_headers)
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert len(users) > 0
    # Check shape of each user
    user = users[0]
    assert "public_id" in user
    assert "email" in user
    assert "display_name" in user
    assert "roles" in user
    assert "permissions" in user
    assert "is_active" in user
    # Assert created_at and updated_at are NOT returned
    assert "created_at" not in user
    assert "updated_at" not in user


def test_get_all_users_pagination(client: TestClient, admin_headers):
    res = client.get("/auth/users?skip=0&limit=2", headers=admin_headers)
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert len(users) <= 2


def test_get_all_users_unauthenticated(client: TestClient):
    res = client.get("/auth/users")
    assert res.status_code == 401


def test_get_all_users_forbidden_for_employee(client: TestClient, employee_headers):
    res = client.get("/auth/users", headers=employee_headers)
    assert res.status_code == 403


def test_get_user_by_public_id(client: TestClient, admin_headers, admin_auth):
    user_pid = admin_auth["user_public_id"]
    res = client.get(f"/auth/users/{user_pid}", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["public_id"] == user_pid
    assert data["email"] == "test.admin@company.com"
    assert "created_at" not in data
    assert "updated_at" not in data

    # Non-existent user
    non_existent_uuid = str(uuid.uuid4())
    res_404 = client.get(f"/auth/users/{non_existent_uuid}", headers=admin_headers)
    assert res_404.status_code == 404


def test_pending_users_and_role_assignment_flow(client: TestClient, admin_headers):
    # 1. User signs up
    unique_email = f"pending.{uuid.uuid4().hex[:8]}@company.com"
    signup_res = client.post(
        "/auth/signup",
        json={"email": unique_email, "display_name": "Alice Wonderland", "password": "Password123!"},
    )
    assert signup_res.status_code == 201
    user_data = signup_res.json()["user"]
    user_pid = user_data["public_id"]
    assert user_data["roles"] == []
    assert user_data["employee_public_id"] is None

    # 2. Admin retrieves pending users
    pending_res = client.get("/auth/pending-users", headers=admin_headers)
    assert pending_res.status_code == 200
    pending_list = pending_res.json()
    pending_emails = [u["email"] for u in pending_list]
    assert unique_email in pending_emails

    # 3. Admin approves user by assigning 'Employee' role
    assign_res = client.post(
        f"/auth/users/{user_pid}/roles",
        json={"role_names": ["Employee"]},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assigned_user = assign_res.json()
    assert "Employee" in assigned_user["roles"]
    assert assigned_user["employee_public_id"] is not None
    emp_pid = assigned_user["employee_public_id"]

    # 4. Verify user is no longer in pending list
    pending_res2 = client.get("/auth/pending-users", headers=admin_headers)
    assert pending_res2.status_code == 200
    pending_emails2 = [u["email"] for u in pending_res2.json()]
    assert unique_email not in pending_emails2

    # 5. Check the auto-provisioned Employee record
    emp_res = client.get(f"/employees/search?public_id={emp_pid}", headers=admin_headers)
    assert emp_res.status_code == 200
    items = emp_res.json()["items"]
    assert len(items) == 1
    emp = items[0]
    assert emp["first_name"] == "Alice"
    assert emp["last_name"] == "Wonderland"
    assert emp["email"] == unique_email
    assert emp["employee_code"].startswith("EMP-")
    assert emp["employee_status"] == "active"
    assert "created_at" not in emp
    assert "updated_at" not in emp
