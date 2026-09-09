"""add_performance_indexes

Revision ID: e7a1b2c3d4e5
Revises: 66ddd769a0f1
Create Date: 2026-08-27 12:38:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e7a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '66ddd769a0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Helper to create index safely if not exists
    # Roles & Permissions
    op.execute("CREATE INDEX IF NOT EXISTS idx_roles_public_id ON roles (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roles_role_name ON roles (role_name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_roles_role_name_lower ON roles (lower(role_name))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_permissions_public_id ON permissions (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions (permission_name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_permissions_name_lower ON permissions (lower(permission_name))")
    op.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id)")

    # Users
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email))")

    # Employees & Organization
    op.execute("CREATE INDEX IF NOT EXISTS idx_employees_public_id ON employees (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON employees (employee_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_departments_public_id ON departments (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_departments_dept_code ON departments (dept_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_designations_public_id ON designations (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_designations_title ON designations (title)")

    # Projects
    op.execute("CREATE INDEX IF NOT EXISTS idx_projects_public_id ON projects (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_project_members_employee_id ON project_members (employee_id)")

    # Attendance & Leaves
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_public_id ON attendance (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance (emp_id, date)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_holidays_public_id ON holidays (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_leave_types_public_id ON leave_types (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_leave_types_name ON leave_types (name)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_elb_public_id ON employee_leave_balances (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_elb_emp_year ON employee_leave_balances (employee_id, year)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_leave_requests_public_id ON leave_requests (public_id)")

    # Payroll
    op.execute("CREATE INDEX IF NOT EXISTS idx_salaries_public_id ON salaries (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bank_details_public_id ON bank_details (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_payroll_runs_public_id ON payroll_runs (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_payroll_runs_payment_status ON payroll_runs (payment_status)")

    # Reviews, Documents, Announcements
    op.execute("CREATE INDEX IF NOT EXISTS idx_pr_public_id ON performance_reviews (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pr_status ON performance_reviews (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_documents_public_id ON employee_documents (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_documents_type ON employee_documents (document_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_announcements_public_id ON announcements (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements (is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_public_id ON notifications (public_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_roles_public_id")
    op.execute("DROP INDEX IF EXISTS idx_roles_role_name")
    op.execute("DROP INDEX IF EXISTS idx_roles_role_name_lower")
    op.execute("DROP INDEX IF EXISTS idx_permissions_public_id")
    op.execute("DROP INDEX IF EXISTS idx_permissions_name")
    op.execute("DROP INDEX IF EXISTS idx_permissions_name_lower")
    op.execute("DROP INDEX IF EXISTS idx_role_permissions_role_id")
    op.execute("DROP INDEX IF EXISTS idx_role_permissions_permission_id")
    op.execute("DROP INDEX IF EXISTS idx_user_roles_user_id")
    op.execute("DROP INDEX IF EXISTS idx_user_roles_role_id")
    op.execute("DROP INDEX IF EXISTS idx_users_public_id")
    op.execute("DROP INDEX IF EXISTS idx_users_is_active")
    op.execute("DROP INDEX IF EXISTS idx_employees_public_id")
    op.execute("DROP INDEX IF EXISTS idx_employees_employee_code")
    op.execute("DROP INDEX IF EXISTS idx_departments_public_id")
    op.execute("DROP INDEX IF EXISTS idx_departments_dept_code")
    op.execute("DROP INDEX IF EXISTS idx_designations_public_id")
    op.execute("DROP INDEX IF EXISTS idx_designations_title")
    op.execute("DROP INDEX IF EXISTS idx_projects_public_id")
    op.execute("DROP INDEX IF EXISTS idx_projects_status")
    op.execute("DROP INDEX IF EXISTS idx_project_members_project_id")
    op.execute("DROP INDEX IF EXISTS idx_project_members_employee_id")
    op.execute("DROP INDEX IF EXISTS idx_attendance_public_id")
    op.execute("DROP INDEX IF EXISTS idx_holidays_public_id")
    op.execute("DROP INDEX IF EXISTS idx_leave_types_public_id")
    op.execute("DROP INDEX IF EXISTS idx_leave_types_name")
    op.execute("DROP INDEX IF EXISTS idx_elb_public_id")
    op.execute("DROP INDEX IF EXISTS idx_elb_emp_year")
    op.execute("DROP INDEX IF EXISTS idx_leave_requests_public_id")
    op.execute("DROP INDEX IF EXISTS idx_salaries_public_id")
    op.execute("DROP INDEX IF EXISTS idx_bank_details_public_id")
    op.execute("DROP INDEX IF EXISTS idx_payroll_runs_public_id")
    op.execute("DROP INDEX IF EXISTS idx_payroll_runs_payment_status")
    op.execute("DROP INDEX IF EXISTS idx_pr_public_id")
    op.execute("DROP INDEX IF EXISTS idx_pr_status")
    op.execute("DROP INDEX IF EXISTS idx_documents_public_id")
    op.execute("DROP INDEX IF EXISTS idx_documents_type")
    op.execute("DROP INDEX IF EXISTS idx_announcements_public_id")
    op.execute("DROP INDEX IF EXISTS idx_announcements_is_active")
    op.execute("DROP INDEX IF EXISTS idx_notifications_public_id")
    op.execute("DROP INDEX IF EXISTS idx_audit_action")
