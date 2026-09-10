# src/main.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import test_connection
from utils.logger import log_action
from routes.auth_routes import router as auth_router
from routes.employee_data_routes import router as employee_router
from routes.department_routes import router as department_router
from routes.designation_routes import router as designation_router
from routes.attendance_routes import router as attendance_router
from routes.holiday_routes import router as holiday_router
from routes.leave_routes import router as leave_router
from routes.payroll_routes import router as payroll_router
from routes.project_routes import router as project_router
from routes.review_routes import router as review_router
from routes.document_routes import router as document_router
from routes.announcement_routes import router as announcement_router
from routes.audit_routes import router as audit_router, audit_alias_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created
    from database import engine, Base
    import models  # import models to register with Base
    Base.metadata.create_all(bind=engine)

    # Test DB connection on startup
    db_info = test_connection()
    if db_info["status"] == "connected":
        log_action("DATABASE_CONNECT", f"Connected to {db_info['database']} as {db_info['user']}")
        print(f"[Database] Successfully connected to {db_info['database']} as {db_info['user']}")
        # Auto-seed initial enterprise data if database is brand new/empty
        try:
            from database import SessionLocal
            from models.user import Role
            with SessionLocal() as db_sess:
                if db_sess.query(Role).count() == 0:
                    print("[DATABASE AUTO-INIT] Empty database detected. Auto-seeding initial enterprise records...")
                    from utils.reset_and_seed_db import seed_all_data
                    seed_all_data()
                    print("[DATABASE AUTO-INIT] Initial database successfully initialized!")
        except Exception as e:
            print(f"[DATABASE AUTO-INIT] Notice on auto-seed: {e}")

        # Synchronize Role Permissions with business rules
        try:
            from database import SessionLocal
            from models.user import Role, Permission, RolePermission
            with SessionLocal() as db_sess:
                emp_role = db_sess.query(Role).filter(Role.role_name == "Employee").first()
                if emp_role:
                    unwanted = ["employee:read", "employee:view", "project:view", "project:read", "review:view", "review:read"]
                    perms_to_remove = [p.permission_id for p in emp_role.permissions if p.permission_name in unwanted]
                    if perms_to_remove:
                        db_sess.query(RolePermission).filter(
                            RolePermission.role_id == emp_role.role_id,
                            RolePermission.permission_id.in_(perms_to_remove)
                        ).delete(synchronize_session=False)
                        db_sess.commit()
                        print("[RBAC SYNC] Employee role permissions synchronized successfully")
        except Exception as e:
            print(f"[RBAC SYNC] Warning: could not sync role permissions: {e}")

        # Auto-close past unclosed attendance shifts from previous days
        try:
            from services.attendance_services import auto_close_past_unclosed_check_ins
            closed = auto_close_past_unclosed_check_ins()
            if closed:
                print(f"[ATTENDANCE] Auto-closed {len(closed)} past unclosed shift(s) from previous days")
        except Exception as e:
            print(f"[ATTENDANCE] Warning: could not auto-close past shifts: {e}")
    else:
        log_action("DATABASE_ERROR", f"Failed to connect: {db_info.get('error')}")
        print(f"[Database] Connection failed: {db_info.get('error')}")
    yield


# Security: Hide interactive Swagger/ReDoc API schemas in production
IS_PRODUCTION = os.getenv("ENVIRONMENT", "production").lower() == "production"

app = FastAPI(
    title="Employee Management System API",
    description="Enterprise API for Employees, RBAC Authentication, Departments, Attendance, Leaves, Payroll, Projects, Reviews, Documents & Announcements",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

allowed_origins = [
    "https://employee-management-system-gules-two.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Allow custom additional origins via environment variable
extra_origins = os.getenv("ALLOWED_ORIGINS", "")
if extra_origins:
    allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(employee_router)
app.include_router(department_router)
app.include_router(designation_router)
app.include_router(attendance_router)
app.include_router(holiday_router)
app.include_router(leave_router)
app.include_router(payroll_router)
app.include_router(project_router)
app.include_router(review_router)
app.include_router(document_router)
app.include_router(announcement_router)
app.include_router(audit_router)
app.include_router(audit_alias_router)


@app.get("/")
def root():
    return {
        "message": "Employee Management System API is running",
        "database": test_connection()["status"],
    }


@app.get("/health", tags=["System"])
def health_check():
    db_status = test_connection()
    return {
        "status": "healthy" if db_status["status"] == "connected" else "unhealthy",
        "database": db_status,
    }