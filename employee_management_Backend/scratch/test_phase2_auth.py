import sys
from pathlib import Path

src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models.user import User, Role, UserRole

client = TestClient(app)

def run_auth_tests():
    print("=== 1. Testing User Signup ===")
    signup_payload = {
        "email": "sarah.connor@cyberdyne.com",
        "display_name": "Sarah Connor",
        "password": "StrongPassword123!",
        "secondary_email": "sarah.backup@gmail.com"
    }
    # Clean up test user if already exists
    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == signup_payload["email"]).first()
        if existing:
            db.delete(existing)
            db.commit()

    res = client.post("/auth/signup", json=signup_payload)
    assert res.status_code == 201, f"Signup failed: {res.status_code} {res.text}"
    signup_data = res.json()
    user_public_id = signup_data["user"]["public_id"]
    access_token = signup_data["tokens"]["access_token"]
    refresh_token = signup_data["tokens"]["refresh_token"]
    print(f"[PASS] User signed up: public_id={user_public_id}, roles={signup_data['user']['roles']}")
    assert "Employee" in signup_data["user"]["roles"], "Default role should be Employee"

    print("\n=== 2. Testing Duplicate Signup Rejection ===")
    dup_res = client.post("/auth/signup", json=signup_payload)
    assert dup_res.status_code == 409, f"Expected 409, got {dup_res.status_code}"
    print("[PASS] Duplicate signup properly rejected with 409 Conflict")

    print("\n=== 3. Testing User Login ===")
    login_res = client.post("/auth/login", json={
        "email": "sarah.connor@cyberdyne.com",
        "password": "StrongPassword123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
    login_data = login_res.json()
    assert "access_token" in login_data["tokens"]
    print(f"[PASS] Logged in successfully: last_login={login_data['user']['last_login']}")

    print("\n=== 4. Testing GET /auth/me (Protected Route) ===")
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200, f"Get /auth/me failed: {me_res.status_code} {me_res.text}"
    me_data = me_res.json()
    assert me_data["email"] == "sarah.connor@cyberdyne.com"
    print(f"[PASS] /auth/me returned profile: {me_data['display_name']} ({me_data['email']})")

    print("\n=== 5. Testing Access Token Refresh ===")
    ref_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200, f"Refresh failed: {ref_res.status_code} {ref_res.text}"
    new_access_token = ref_res.json()["access_token"]
    assert new_access_token != access_token
    print("[PASS] Successfully refreshed access token")

    print("\n=== 6. Testing RBAC Permission Guard (Employee blocked from Admin routes) ===")
    roles_res = client.get("/auth/roles", headers=headers)
    assert roles_res.status_code == 403, f"Expected 403 Forbidden, got {roles_res.status_code}"
    print("[PASS] Standard Employee correctly blocked with 403 from viewing /auth/roles")

    print("\n=== 7. Upgrading User to Admin Role & Verifying Permission Bypass ===")
    with SessionLocal() as db:
        u = db.query(User).filter(User.public_id == user_public_id).first()
        admin_role = db.query(Role).filter(Role.role_name == "Admin").first()
        db.add(UserRole(user_id=u.user_id, role_id=admin_role.role_id))
        db.commit()

    # Re-login to get updated token
    relogin_res = client.post("/auth/login", json={
        "email": "sarah.connor@cyberdyne.com",
        "password": "StrongPassword123!"
    })
    admin_token = relogin_res.json()["tokens"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    roles_allowed = client.get("/auth/roles", headers=admin_headers)
    assert roles_allowed.status_code == 200, f"Admin should be allowed: {roles_allowed.text}"
    print(f"[PASS] Admin user accessed /auth/roles: found {len(roles_allowed.json())} system roles")

    perms_allowed = client.get("/auth/permissions", headers=admin_headers)
    assert perms_allowed.status_code == 200
    print(f"[PASS] Admin user accessed /auth/permissions: found {len(perms_allowed.json())} granular permissions")

    print("\n=== 8. Testing Password Reset Flow ===")
    forgot_res = client.post("/auth/forgot-password", json={"email": "sarah.connor@cyberdyne.com"})
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json().get("reset_token")
    assert reset_token is not None
    print(f"[PASS] Generated password reset token: {reset_token[:10]}...")

    reset_res = client.post("/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewSuperSecretPassword2026!"
    })
    assert reset_res.status_code == 200
    print("[PASS] Password reset confirmed")

    # Login with new password
    new_login = client.post("/auth/login", json={
        "email": "sarah.connor@cyberdyne.com",
        "password": "NewSuperSecretPassword2026!"
    })
    assert new_login.status_code == 200
    print("[PASS] Successfully logged in with new password")

    print("\n=== 9. Cleaning Up Test Data ===")
    with SessionLocal() as db:
        u = db.query(User).filter(User.public_id == user_public_id).first()
        if u:
            db.delete(u)
            db.commit()
    print("[PASS] Test user cleaned up")

    print("\n ALL PHASE 1 & 2 AUTH & RBAC TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_auth_tests()
