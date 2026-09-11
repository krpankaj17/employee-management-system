# src/routes/dashboard_routes.py
from datetime import date as py_date, datetime, timezone, timedelta
from decimal import Decimal
from typing import cast
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from database import get_db
from core.permissions import get_current_user
from models.user import User, Role, UserRole
from models.employee import Employee
from models.department import Department
from models.attendance import Attendance
from models.leave import LeaveRequest, EmployeeLeaveBalance
from models.project import Project
from models.announcement import Announcement
from models.payroll import PayrollRun
from services.employee_services import sync_employee_leave_statuses

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Enterprise Analytics"])


@router.get("/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    High-performance consolidated enterprise dashboard summary endpoint.
    Performs aggregated count queries in a single round-trip, replacing 10+
    heavy paginated API calls from the client.
    """
    # 0. Sync leave statuses with current date
    sync_employee_leave_statuses(db)

    today = py_date.today()
    today_str = today.isoformat()

    user_roles_lower = [r.role_name.lower().strip() for r in current_user.roles]
    is_admin_or_hr = (
        any(r in user_roles_lower for r in ("admin", "hr_manager", "hr", "department_head", "project_lead", "project_manager", "manager"))
        or getattr(current_user, "is_superuser", False)
    )

    user_emp = current_user.employee
    my_emp_id = user_emp.emp_id if user_emp else None
    my_emp_public_id = str(user_emp.public_id) if user_emp else None

    # 1. Employee stats
    total_emp = db.scalar(select(func.count(Employee.emp_id))) or 0
    active_emp = db.scalar(
        select(func.count(Employee.emp_id)).where(
            func.lower(Employee.employee_status) == "active",
            Employee.is_active == True,
        )
    ) or 0
    on_leave_emp = db.scalar(
        select(func.count(Employee.emp_id)).where(
            func.lower(Employee.employee_status) == "on_leave"
        )
    ) or 0
    inactive_emp = db.scalar(
        select(func.count(Employee.emp_id)).where(
            or_(
                func.lower(Employee.employee_status).in_(["inactive", "terminated", "suspended", "resigned"]),
                Employee.is_active == False,
            )
        )
    ) or 0

    inactive_users_count = db.scalar(
        select(func.count(User.user_id)).where(User.is_active == False)
    ) or 0
    inactive_emp = max(inactive_emp, inactive_users_count)
    if total_emp > (active_emp + on_leave_emp):
        inactive_emp = max(inactive_emp, total_emp - active_emp - on_leave_emp)

    # 2. Departments count & breakdown
    dept_count = db.scalar(select(func.count(Department.dept_id))) or 0
    dept_records = db.scalars(select(Department).order_by(Department.dept_id.asc())).all()
    departments_data = [
        {
            "public_id": str(d.public_id),
            "dept_name": d.dept_name,
            "department_name": d.dept_name,
            "dept_code": d.dept_code,
            "department_code": d.dept_code,
            "employee_count": len([e for e in d.employees if (getattr(e, "employee_status", "") or "").lower() in ("active", "on_leave")]) if d.employees else 0,
            "head_employee_name": f"{d.head_employee.first_name} {d.head_employee.last_name}" if d.head_employee else "Lead Assigned",
        }
        for d in dept_records
    ]

    # 3. Today's Attendance
    present_today = db.scalar(
        select(func.count(Attendance.attendance_id)).where(
            Attendance.date == today,
            or_(
                func.lower(Attendance.status) == "present",
                Attendance.check_in.is_not(None)
            )
        )
    ) or 0

    # 4. Leaves (Only Admin/HR sees who is on leave and company-wide leave totals; employees see only their own)
    employees_on_leave = []
    my_pending_leaves = 0
    my_remaining_leaves = 0

    if is_admin_or_hr:
        on_leave_today = db.scalar(
            select(func.count(LeaveRequest.leave_id)).where(
                func.lower(LeaveRequest.status) == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
            )
        ) or 0

        pending_leaves = db.scalar(
            select(func.count(LeaveRequest.leave_id)).where(
                func.lower(LeaveRequest.status) == "pending"
            )
        ) or 0

        # Detailed list of employees currently on leave (Admin/HR only)
        leave_records = db.scalars(
            select(LeaveRequest)
            .where(
                func.lower(LeaveRequest.status) == "approved",
                LeaveRequest.start_date <= today,
                LeaveRequest.end_date >= today,
            )
            .order_by(LeaveRequest.start_date.desc())
        ).all()

        employees_on_leave = [
            {
                "leave_public_id": str(lr.public_id),
                "employee_public_id": str(lr.employee.public_id) if lr.employee else None,
                "employee_name": f"{lr.employee.first_name} {lr.employee.last_name}" if lr.employee else "Unknown",
                "employee_code": lr.employee.employee_code if lr.employee else None,
                "department_name": lr.employee.department_name if lr.employee else None,
                "designation_name": lr.employee.designation_name if lr.employee else None,
                "leave_type_name": lr.leave_type.name if lr.leave_type else "Time Off",
                "start_date": lr.start_date.isoformat() if lr.start_date else "",
                "end_date": lr.end_date.isoformat() if lr.end_date else "",
                "total_days": float(lr.total_days or 0),
                "reason": lr.reason,
            }
            for lr in leave_records
        ]

        # Also include any employees whose employee_status is explicitly 'on_leave'
        covered_emp_ids = {lr.employee_id for lr in leave_records if lr.employee_id}
        on_leave_employees = db.scalars(
            select(Employee).where(func.lower(Employee.employee_status) == "on_leave")
        ).all()
        for emp in on_leave_employees:
            if emp.emp_id not in covered_emp_ids:
                employees_on_leave.append({
                    "leave_public_id": f"status-{emp.public_id}",
                    "employee_public_id": str(emp.public_id),
                    "employee_name": f"{emp.first_name} {emp.last_name}".strip(),
                    "employee_code": emp.employee_code,
                    "department_name": emp.department_name,
                    "designation_name": emp.designation_name,
                    "leave_type_name": "On Leave",
                    "start_date": today_str,
                    "end_date": today_str,
                    "total_days": 1.0,
                    "reason": "On Leave",
                })
        on_leave_today = max(on_leave_today, len(employees_on_leave))
    else:
        # Regular Employee: Hide company-wide on-leave count and list completely
        on_leave_today = 0
        pending_leaves = 0
        employees_on_leave = []

        if my_emp_id:
            my_pending_leaves = db.scalar(
                select(func.count(LeaveRequest.leave_id)).where(
                    LeaveRequest.employee_id == my_emp_id,
                    func.lower(LeaveRequest.status) == "pending",
                )
            ) or 0
            my_balances = db.scalars(
                select(EmployeeLeaveBalance).where(
                    EmployeeLeaveBalance.employee_id == my_emp_id,
                    EmployeeLeaveBalance.year == today.year,
                )
            ).all()
            my_remaining_leaves = sum((b.total_allocated - b.used_leaves) for b in my_balances)

    # 5. Projects
    active_projects = db.scalar(
        select(func.count(Project.project_id)).where(
            func.lower(Project.status).in_(["active", "in_progress"])
        )
    ) or 0

    # 6. Pending User Approvals (users without assigned roles)
    subq = select(UserRole.user_id).distinct()
    pending_users = db.scalar(
        select(func.count(User.user_id)).where(
            User.user_id.not_in(subq)
        )
    ) or 0

    # 7. Payroll metrics (Admins/HR see enterprise total, employees see personal pay)
    payroll_total = 0.0
    payroll_runs_count = 0
    my_net_pay = 0.0

    if is_admin_or_hr:
        payroll_runs_count = db.scalar(select(func.count(PayrollRun.payroll_id))) or 0
        total_sum = db.scalar(select(func.sum(PayrollRun.net_paid)))
        if total_sum is not None:
            payroll_total = float(total_sum)
    
    if my_emp_id:
        latest_my_run = db.scalars(
            select(PayrollRun)
            .where(PayrollRun.emp_id == my_emp_id)
            .order_by(PayrollRun.payroll_id.desc())
            .limit(1)
        ).first()
        if latest_my_run and latest_my_run.net_paid:
            my_net_pay = float(latest_my_run.net_paid)

    # 8. Weekly attendance breakdown (Mon - Fri of current week)
    current_dow = today.weekday()  # Monday is 0, Sunday is 6
    monday = today - timedelta(days=current_dow)
    week_days = []
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    for i in range(5):
        d = monday + timedelta(days=i)
        d_str = d.isoformat()
        week_days.append({
            "name": f"{day_names[i]}{' (Today)' if d_str == today_str else ''}",
            "date": d,
            "dateStr": d_str,
            "isToday": d_str == today_str,
        })

    # Fetch attendance count for each day of current week in a single query
    week_start = week_days[0]["date"]
    week_end = week_days[-1]["date"]
    week_counts_raw = db.execute(
        select(Attendance.date, func.count(Attendance.attendance_id))
        .where(
            Attendance.date >= week_start,
            Attendance.date <= week_end,
            or_(
                func.lower(Attendance.status) == "present",
                Attendance.check_in.is_not(None)
            )
        )
        .group_by(Attendance.date)
    ).all()

    week_counts_map = {row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]): row[1] for row in week_counts_raw}
    base_total = total_emp if total_emp > 0 else 1

    weekly_attendance_chart = []
    for wd in week_days:
        present_count = week_counts_map.get(wd["dateStr"], 0)
        pct = 0 if wd["dateStr"] > today_str else min(100, round((present_count / base_total) * 100))
        weekly_attendance_chart.append({
            "day": wd["name"],
            "dateStr": wd["dateStr"],
            "present": present_count,
            "total": total_emp,
            "pct": pct,
            "hours": 8,
        })

    # 9. Current User's Today Punch Status
    today_user_punch = {
        "checked_in": False,
        "shift_completed": False,
        "check_in_time": None,
        "check_out_time": None,
        "work_mode": "Office",
    }
    if my_emp_id:
        my_rec = db.scalars(
            select(Attendance)
            .where(
                Attendance.emp_id == my_emp_id,
                Attendance.date == today
            )
            .order_by(Attendance.attendance_id.desc())
            .limit(1)
        ).first()
        if my_rec:
            cin = my_rec.check_in.isoformat() if my_rec.check_in else None
            cout = my_rec.check_out.isoformat() if my_rec.check_out else None
            today_user_punch = {
                "checked_in": bool(cin and not cout),
                "shift_completed": bool(cin and cout),
                "check_in_time": cin,
                "check_out_time": cout,
                "work_mode": my_rec.work_mode or "Office",
            }

    # 10. Recent Projects (top 5)
    recent_projects_query = select(Project).order_by(Project.project_id.desc()).limit(5)
    recent_projects_records = db.scalars(recent_projects_query).all()
    recent_projects = [
        {
            "public_id": str(p.public_id),
            "project_name": p.project_name,
            "project_code": f"PRJ-{(str(p.public_id)[:4]).upper()}",
            "status": p.status or "planning",
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "project_head_name": f"{p.project_head.first_name} {p.project_head.last_name}" if p.project_head else None,
            "members_count": len(p.members) if p.members else 0,
            "completion_percentage": 100 if p.status == "completed" else 65 if p.status in ("active", "in_progress") else 20,
        }
        for p in recent_projects_records
    ]

    # 11. Recent Announcements (top 3)
    recent_announcements_query = select(Announcement).where(Announcement.is_active == True).order_by(
        Announcement.announcement_id.desc()
    ).limit(3)
    recent_announcements_records = db.scalars(recent_announcements_query).all()
    recent_announcements = [
        {
            "public_id": str(a.public_id),
            "title": a.title,
            "content": a.content,
            "priority": a.priority,
            "is_pinned": a.priority in ("high", "urgent"),
            "published_at": a.created_at.isoformat() if a.created_at else None,
            "author_name": f"{a.author.first_name} {a.author.last_name}" if a.author else "Administration",
        }
        for a in recent_announcements_records
    ]

    return {
        "ok": True,
        "metrics": {
            "total_employees": total_emp,
            "active_employees": active_emp,
            "on_leave_employees": on_leave_emp,
            "inactive_employees": inactive_emp,
            "departments_count": dept_count,
            "present_today": present_today,
            "on_leave_today": on_leave_today,
            "pending_leaves": pending_leaves,
            "my_pending_leaves": my_pending_leaves,
            "my_remaining_leaves": my_remaining_leaves,
            "active_projects_count": active_projects,
            "pending_approvals": pending_users,
            "payroll_total": payroll_total,
            "payroll_runs_count": payroll_runs_count,
            "my_net_pay": my_net_pay,
        },
        "employees_on_leave": employees_on_leave,
        "weekly_attendance": weekly_attendance_chart,
        "today_user_punch": today_user_punch,
        "recent_projects": recent_projects,
        "recent_announcements": recent_announcements,
        "departments": departments_data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
