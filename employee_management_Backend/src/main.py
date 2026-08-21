# src/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
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
from routes.audit_routes import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Test DB connection on startup
    db_info = test_connection()
    if db_info["status"] == "connected":
        log_action("DATABASE_CONNECT", f"Connected to {db_info['database']} as {db_info['user']}")
        print(f"[Database] Successfully connected to {db_info['database']} as {db_info['user']}")
    else:
        log_action("DATABASE_ERROR", f"Failed to connect: {db_info.get('error')}")
        print(f"[Database] Connection failed: {db_info.get('error')}")
    yield


app = FastAPI(
    title="Employee Management System API",
    description="Enterprise API for Employees, RBAC Authentication, Departments, Attendance, Leaves, Payroll, Projects, Reviews, Documents & Announcements",
    version="2.0.0",
    lifespan=lifespan,
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