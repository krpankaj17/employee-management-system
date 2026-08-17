#main.py
from fastapi import FastAPI
from routes.employee_data_routes import router as employee_router
from routes.department_routes import router as department_router
from routes.attendance_routes import router as attendance_router

app = FastAPI(
    title="Employee Management System",
    description="API for managing employees, departments, and attendance",
    version="1.1.0"
)

app.include_router(employee_router)
app.include_router(department_router)
app.include_router(attendance_router)


@app.get("/")
def root():
    return {
        "message": "Employee Management System API is running"
    }