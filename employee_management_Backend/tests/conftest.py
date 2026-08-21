import sys
import uuid
import datetime
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure src directory is on sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from main import app
from database import SessionLocal
from models.user import User, Role, UserRole
from models.employee import Employee
from models.department import Department
from models.designation import Designation
from core import security


@pytest.fixture(scope="session")
def client():
    """Provides a FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def db():
    """Provides an isolated SQLAlchemy session for direct assertions."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _get_or_create_test_user(
    email: str,
    display_name: str,
    role_name: str,
    emp_code: str,
    first_name: str,
    last_name: str,
):
    with SessionLocal() as db:
        # Check role exists
        role = db.query(Role).filter(Role.role_name == role_name).first()
        if not role:
            role = Role(role_name=role_name, description=f"Test role {role_name}")
            db.add(role)
            db.flush()

        # Check or create user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                display_name=display_name,
                password_hash=security.hash_password("TestPass123!"),
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user.password_hash = security.hash_password("TestPass123!")
            user.is_active = True
            db.flush()

        # Link role
        ur = (
            db.query(UserRole)
            .filter(UserRole.user_id == user.user_id, UserRole.role_id == role.role_id)
            .first()
        )
        if not ur:
            db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
            db.flush()

        # Check or create employee
        emp = db.query(Employee).filter(Employee.user_id == user.user_id).first()
        if not emp:
            emp = Employee(
                user_id=user.user_id,
                employee_code=emp_code,
                first_name=first_name,
                last_name=last_name,
                gender="male",
                email=email,
                phone=f"+91{uuid.uuid4().int % 10000000000:010d}",
                date_of_birth=datetime.date(1990, 1, 1),
                joining_date=datetime.date(2022, 1, 1),
                employee_status="active",
                employment_type="full_time",
                is_active=True,
            )
            db.add(emp)
            db.flush()

        db.commit()

        # Generate JWT
        token = security.create_access_token({
            "sub": str(user.public_id),
            "email": user.email,
            "roles": [r.role_name for r in user.roles],
        })
        return token, str(user.public_id), str(emp.public_id)


@pytest.fixture(scope="session")
def admin_auth():
    token, user_pid, emp_pid = _get_or_create_test_user(
        email="test.admin@company.com",
        display_name="Test Admin",
        role_name="Admin",
        emp_code="EMP-TEST-ADM",
        first_name="Admin",
        last_name="Tester",
    )
    return {"token": token, "user_public_id": user_pid, "employee_public_id": emp_pid}


@pytest.fixture(scope="session")
def admin_headers(admin_auth):
    return {"Authorization": f"Bearer {admin_auth['token']}"}


@pytest.fixture(scope="session")
def hr_auth():
    token, user_pid, emp_pid = _get_or_create_test_user(
        email="test.hr@company.com",
        display_name="Test HR",
        role_name="HR_Manager",
        emp_code="EMP-TEST-HR",
        first_name="HR",
        last_name="Tester",
    )
    return {"token": token, "user_public_id": user_pid, "employee_public_id": emp_pid}


@pytest.fixture(scope="session")
def hr_headers(hr_auth):
    return {"Authorization": f"Bearer {hr_auth['token']}"}


@pytest.fixture(scope="session")
def manager_auth():
    token, user_pid, emp_pid = _get_or_create_test_user(
        email="test.manager@company.com",
        display_name="Test Manager",
        role_name="Department_Head",
        emp_code="EMP-TEST-MGR",
        first_name="Manager",
        last_name="Tester",
    )
    return {"token": token, "user_public_id": user_pid, "employee_public_id": emp_pid}


@pytest.fixture(scope="session")
def manager_headers(manager_auth):
    return {"Authorization": f"Bearer {manager_auth['token']}"}


@pytest.fixture(scope="session")
def employee_auth():
    token, user_pid, emp_pid = _get_or_create_test_user(
        email="test.employee@company.com",
        display_name="Test Employee",
        role_name="Employee",
        emp_code="EMP-TEST-EMP",
        first_name="Employee",
        last_name="Tester",
    )
    return {"token": token, "user_public_id": user_pid, "employee_public_id": emp_pid}


@pytest.fixture(scope="session")
def employee_headers(employee_auth):
    return {"Authorization": f"Bearer {employee_auth['token']}"}
