#main.py
from fastapi import FastAPI
from routes.employee_data_routes import router as employee_router
from routes.department_routes import router as department_router

app = FastAPI(
    title="Employee Management System",
    description="API for managing employees",
    version="1.0.0"
)

app.include_router(employee_router)
app.include_router(department_router)


@app.get("/")
def root():
    return {
        "message": "Employee Management System API is running"
    }