-- ===================================================================
-- Flyway Migration: V3__add_performance_indexes.sql
-- Description: Additional database performance indexes across all entities
-- ===================================================================

-- 1. Users, Roles & Permissions
CREATE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_roles_public_id ON roles (public_id);
CREATE INDEX IF NOT EXISTS idx_roles_role_name ON roles (role_name);
CREATE INDEX IF NOT EXISTS idx_roles_role_name_lower ON roles (lower(role_name));

CREATE INDEX IF NOT EXISTS idx_permissions_public_id ON permissions (public_id);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions (permission_name);
CREATE INDEX IF NOT EXISTS idx_permissions_name_lower ON permissions (lower(permission_name));

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- 2. Employees, Addresses & Emergency Contacts
CREATE INDEX IF NOT EXISTS idx_employees_public_id ON employees (public_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON employees (employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (email);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees (dept_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees (designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees (reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (employee_status);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees (is_active);

CREATE INDEX IF NOT EXISTS idx_addresses_public_id ON addresses (public_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_emp_id ON emergency_contacts (emp_id);
CREATE INDEX IF NOT EXISTS idx_employee_addresses_emp_id ON employee_addresses (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_addresses_address_id ON employee_addresses (address_id);

-- 3. Departments & Designations
CREATE INDEX IF NOT EXISTS idx_departments_public_id ON departments (public_id);
CREATE INDEX IF NOT EXISTS idx_departments_dept_code ON departments (dept_code);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments (head_employee_id);

CREATE INDEX IF NOT EXISTS idx_designations_public_id ON designations (public_id);
CREATE INDEX IF NOT EXISTS idx_designations_title ON designations (title);

-- 4. Projects & Members
CREATE INDEX IF NOT EXISTS idx_projects_public_id ON projects (public_id);
CREATE INDEX IF NOT EXISTS idx_projects_head ON projects (project_head_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_employee_id ON project_members (employee_id);

-- 5. Attendance & Holidays
CREATE INDEX IF NOT EXISTS idx_attendance_public_id ON attendance (public_id);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance (emp_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_holidays_public_id ON holidays (public_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays (date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays (year);

-- 6. Leaves & Approval History
CREATE INDEX IF NOT EXISTS idx_leave_types_public_id ON leave_types (public_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_name ON leave_types (name);
CREATE INDEX IF NOT EXISTS idx_elb_public_id ON employee_leave_balances (public_id);
CREATE INDEX IF NOT EXISTS idx_elb_emp_year ON employee_leave_balances (employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_public_id ON leave_requests (public_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_status ON leave_requests (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_lah_leave_id ON leave_approval_history (leave_id);
CREATE INDEX IF NOT EXISTS idx_lah_action_by ON leave_approval_history (action_by);

-- 7. Payroll & Salaries
CREATE INDEX IF NOT EXISTS idx_salaries_public_id ON salaries (public_id);
CREATE INDEX IF NOT EXISTS idx_salaries_emp ON salaries (emp_id);
CREATE INDEX IF NOT EXISTS idx_salaries_effective ON salaries (effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_salary_components_salary_id ON salary_components (salary_id);
CREATE INDEX IF NOT EXISTS idx_bank_details_public_id ON bank_details (public_id);
CREATE INDEX IF NOT EXISTS idx_bank_details_emp_id ON bank_details (emp_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_public_id ON payroll_runs (public_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_emp ON payroll_runs (emp_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON payroll_runs (pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs (payment_status);

-- 8. Performance Reviews
CREATE INDEX IF NOT EXISTS idx_pr_public_id ON performance_reviews (public_id);
CREATE INDEX IF NOT EXISTS idx_pr_emp_id ON performance_reviews (emp_id);
CREATE INDEX IF NOT EXISTS idx_pr_reviewer_id ON performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON performance_reviews (status);

-- 9. Documents, Announcements, Notifications & Audit
CREATE INDEX IF NOT EXISTS idx_documents_public_id ON employee_documents (public_id);
CREATE INDEX IF NOT EXISTS idx_documents_emp ON employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON employee_documents (document_type);

CREATE INDEX IF NOT EXISTS idx_announcements_public_id ON announcements (public_id);
CREATE INDEX IF NOT EXISTS idx_announcements_target_type ON announcements (target_type);
CREATE INDEX IF NOT EXISTS idx_announcements_target_dept_id ON announcements (target_dept_id);
CREATE INDEX IF NOT EXISTS idx_announcements_posted_by ON announcements (posted_by);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements (is_active);

CREATE INDEX IF NOT EXISTS idx_notifications_public_id ON notifications (public_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target_type ON notifications (target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
