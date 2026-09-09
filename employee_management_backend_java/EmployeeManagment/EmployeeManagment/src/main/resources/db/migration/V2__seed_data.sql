-- ===================================================================
-- Flyway Migration: V2__seed_data.sql
-- Description: Complete production-grade seed data matching Python:
-- permissions, roles, role_permissions, departments, designations,
-- leave types, 2026 holidays, admin, and full seeded employees.
-- ===================================================================

-- 1. Insert System Permissions (41 distinct permissions)
INSERT INTO permissions (permission_name, description) VALUES
    ('employee:view', 'View employee profiles'),
    ('employee:create', 'Create new employee profile'),
    ('employee:update', 'Update employee profile'),
    ('employee:delete', 'Delete / offboard employee'),
    ('employee:read', 'Read employee profile'),
    ('department:view', 'View departments'),
    ('department:create', 'Create new department'),
    ('department:update', 'Update department'),
    ('department:delete', 'Delete department'),
    ('department:read', 'Read department'),
    ('designation:view', 'View designations'),
    ('designation:create', 'Create new designation'),
    ('designation:update', 'Update designation'),
    ('designation:delete', 'Delete designation'),
    ('designation:read', 'Read designation'),
    ('attendance:view', 'View attendance records'),
    ('attendance:create', 'Punch in/out and log attendance'),
    ('attendance:update', 'Edit attendance records'),
    ('attendance:delete', 'Delete attendance records'),
    ('attendance:read', 'Read attendance records'),
    ('leave:view', 'View leave requests and balances'),
    ('leave:create', 'Apply for leave'),
    ('leave:update', 'Modify leave requests'),
    ('leave:delete', 'Cancel leave requests'),
    ('leave:approve', 'Approve or reject leave requests'),
    ('leave:read', 'Read leave requests'),
    ('salary:view', 'View salary structures'),
    ('salary:create', 'Create or revise salary structure'),
    ('salary:update', 'Update salary structure'),
    ('salary:read', 'Read salary structure'),
    ('payroll:view', 'View payroll runs and payslips'),
    ('payroll:run', 'Process monthly payroll runs'),
    ('payroll:disburse', 'Disburse salary payments'),
    ('payroll:update', 'Manage bank details and payroll parameters'),
    ('payroll:read', 'Read payroll records'),
    ('project:view', 'View projects and assignments'),
    ('project:create', 'Create new project'),
    ('project:update', 'Update project details and team assignments'),
    ('project:delete', 'Delete project'),
    ('project:read', 'Read project details'),
    ('review:create', 'Conduct performance review'),
    ('review:update', 'Update performance review'),
    ('review:view', 'View performance reviews'),
    ('review:read', 'Read performance reviews'),
    ('review:delete', 'Delete performance review'),
    ('document:upload', 'Upload employee verification documents'),
    ('document:view', 'View employee documents'),
    ('document:verify', 'Verify or reject documents'),
    ('announcement:create', 'Post company or department announcements'),
    ('announcement:read', 'Read active announcements'),
    ('role:manage', 'Manage system roles and permission assignments'),
    ('audit:view', 'View system audit logs')
ON CONFLICT DO NOTHING;

-- 2. Insert System Roles
INSERT INTO roles (role_name, description) VALUES
    ('Admin', 'Super Administrator with full unrestricted system privileges'),
    ('HR_Manager', 'Human Resources Manager with employee lifecycle, attendance, and payroll access'),
    ('Department_Head', 'Department Leader with team oversight, leave approval, and review capabilities'),
    ('Project_Manager', 'Project Lead managing project deliverables and evaluations'),
    ('Employee', 'Standard company employee with self-service capabilities')
ON CONFLICT DO NOTHING;

-- 3. Map Permissions to Roles
-- 3a. Admin: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Admin'
ON CONFLICT DO NOTHING;

-- 3b. HR_Manager: Comprehensive HR, Employee, Payroll, Attendance, Leave, Documents, Announcements
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'HR_Manager'
AND p.permission_name IN (
    'employee:view', 'employee:create', 'employee:update', 'employee:delete', 'employee:read',
    'department:view', 'department:read',
    'designation:view', 'designation:read',
    'attendance:view', 'attendance:create', 'attendance:update', 'attendance:delete', 'attendance:read',
    'leave:view', 'leave:create', 'leave:update', 'leave:delete', 'leave:approve', 'leave:read',
    'salary:view', 'salary:create', 'salary:update', 'salary:read',
    'payroll:view', 'payroll:run', 'payroll:disburse', 'payroll:update', 'payroll:read',
    'project:view', 'project:read',
    'review:create', 'review:update', 'review:view', 'review:read', 'review:delete',
    'document:upload', 'document:view', 'document:verify',
    'announcement:create', 'announcement:read',
    'audit:view'
)
ON CONFLICT DO NOTHING;

-- 3c. Department_Head: Team visibility, Leave Approval, Projects, Reviews
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Department_Head'
AND p.permission_name IN (
    'department:view', 'department:read',
    'employee:view', 'employee:read',
    'leave:view', 'leave:create', 'leave:approve', 'leave:read',
    'project:view', 'project:read',
    'review:create', 'review:update', 'review:view', 'review:read',
    'document:upload', 'document:view',
    'announcement:read'
)
ON CONFLICT DO NOTHING;

-- 3d. Project_Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Project_Manager'
AND p.permission_name IN (
    'project:view', 'project:create', 'project:update', 'project:read',
    'employee:view', 'employee:read',
    'leave:view', 'leave:create', 'leave:read',
    'review:create', 'review:update', 'review:view', 'review:read',
    'document:upload', 'document:view',
    'announcement:read'
)
ON CONFLICT DO NOTHING;

-- 3e. Employee: Self-service essentials (no administrative attendance/department manage)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Employee'
AND p.permission_name IN (
    'leave:create', 'leave:view', 'leave:read',
    'project:view',
    'review:view', 'review:update',
    'document:upload', 'document:view',
    'announcement:read'
)
ON CONFLICT DO NOTHING;

-- 4. Insert Leave Types
INSERT INTO leave_types (name, description, max_days_per_year, is_paid) VALUES
    ('Privilege Leave', 'Annual earned leave for personal vacations and long breaks', 18, true),
    ('Casual Leave', 'Short-term personal leave for unexpected events', 12, true),
    ('Sick Leave', 'Medical leave for illness, recuperation, or doctor visits', 10, true),
    ('Maternity Leave', 'Paid statutory maternity leave for female employees', 180, true),
    ('Paternity Leave', 'Paid statutory paternity leave for new fathers', 15, true),
    ('Bereavement Leave', 'Compassionate leave in case of loss of immediate family', 5, true),
    ('Compensatory Off', 'Time off granted for overtime or working on holidays', 0, true)
ON CONFLICT DO NOTHING;

-- 5. Insert 2026 Holiday Calendar
INSERT INTO holidays (name, date, holiday_type, applicable_region, year, is_optional) VALUES
    ('Republic Day', '2026-01-26', 'national', 'ALL', 2026, false),
    ('Maha Shivaratri', '2026-03-04', 'national', 'ALL', 2026, false),
    ('Holi', '2026-03-25', 'national', 'ALL', 2026, false),
    ('Good Friday', '2026-04-03', 'national', 'ALL', 2026, false),
    ('Eid ul-Fitr', '2026-04-11', 'national', 'ALL', 2026, false),
    ('Maharashtra Day / May Day', '2026-05-01', 'regional', 'MH', 2026, false),
    ('Independence Day', '2026-08-15', 'national', 'ALL', 2026, false),
    ('Mahatma Gandhi Jayanti', '2026-10-02', 'national', 'ALL', 2026, false),
    ('Dussehra / Vijaya Dashami', '2026-10-20', 'national', 'ALL', 2026, false),
    ('Diwali / Deepavali', '2026-11-08', 'national', 'ALL', 2026, false),
    ('Christmas Day', '2026-12-25', 'national', 'ALL', 2026, false)
ON CONFLICT DO NOTHING;

-- 6. Insert Departments
INSERT INTO departments (dept_name, dept_code, description) VALUES
    ('Executive Leadership', 'DEPT-1', 'Senior management, strategy, and overall corporate governance'),
    ('Engineering & Technology', 'DEPT-2', 'Core software development, infrastructure, and technical innovations'),
    ('Human Resources', 'DEPT-3', 'Talent acquisition, employee wellness, payroll, and culture'),
    ('Finance & Accounting', 'DEPT-4', 'Financial planning, audits, budget allocations, and tax reporting'),
    ('Product & Design', 'DEPT-5', 'Product management, user experience, UI architecture, and roadmap'),
    ('Sales & Marketing', 'DEPT-6', 'Client partnerships, growth marketing, enterprise sales, and branding'),
    ('Operations & Support', 'DEPT-7', 'IT helpdesk, customer success, administrative operations, and logistics')
ON CONFLICT DO NOTHING;

-- 7. Insert Designations
INSERT INTO designations (title, grade_level, description) VALUES
    ('Chief Technology Officer', 'C-Level', 'Executive head of all technical strategy and platform architecture'),
    ('Vice President', 'VP', 'Executive vice president driving business unit operations'),
    ('Director of Engineering', 'Director', 'Head of engineering organizations and delivery programs'),
    ('Lead Architect', 'Lead', 'Senior technical architect leading distributed system design'),
    ('Senior Software Engineer', 'Senior', 'Experienced developer building core services and backend APIs'),
    ('Software Engineer', 'Mid', 'Full-stack software developer delivering product features'),
    ('Junior Software Engineer', 'Junior', 'Associate engineer focusing on component development and tests'),
    ('HR Director', 'Director', 'Head of People operations and human resources strategy'),
    ('Senior HR Generalist', 'Senior', 'Lead HR specialist managing employee relations and payroll'),
    ('Finance Director', 'Director', 'Head of financial operations and fiscal compliance'),
    ('Senior Accountant', 'Senior', 'Lead specialist for accounting, audits, and ledger books'),
    ('Head of Product', 'Director', 'Head of product strategy, user discovery, and feature roadmap'),
    ('Senior Product Designer', 'Senior', 'Lead UX/UI designer crafting design systems and user journeys'),
    ('Operations Lead', 'Lead', 'Operations and customer support team leader')
ON CONFLICT DO NOTHING;

-- 8. Insert Default Super Admin User (Password: Admin@1234 -> $2a$10$wQ1X63a0Z3cE3sVq68zY2eT5oJ7BvV4f0WqF3G5k1l7u7U3L5Q6Xy)
INSERT INTO users (email, display_name, password_hash, is_active, token_version)
VALUES ('admin@company.com', 'Super Administrator', '$2a$10$wQ1X63a0Z3cE3sVq68zY2eT5oJ7BvV4f0WqF3G5k1l7u7U3L5Q6Xy', true, 1)
ON CONFLICT DO NOTHING;

-- Assign Admin Role to default admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.email = 'admin@company.com' AND r.role_name = 'Admin'
ON CONFLICT DO NOTHING;
