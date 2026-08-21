-- ============================================================================
-- MIGRATION: v2.1 → v2.2
-- Employee Management System — Schema Alterations
-- Generated: 2026-08-20
-- ============================================================================
--
-- Run this ONCE against an existing employee_management database (v2.1).
-- This script is idempotent and handles existing data and orphaned records.
-- ============================================================================

-- If a previous statement failed in your GUI session, reset the transaction state first:
ROLLBACK;

BEGIN;


-- ============================================================================
-- STEP 1: NEW TRIGGER FUNCTIONS
-- ============================================================================

-- 1.1 Sync email: employees.email changes → update users.email
CREATE OR REPLACE FUNCTION sync_employee_email_to_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE users SET email = NEW.email
        WHERE user_id = NEW.user_id
          AND email IS DISTINCT FROM NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.2 Sync email: users.email changes → update employees.email
CREATE OR REPLACE FUNCTION sync_user_email_to_employee()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE employees SET email = NEW.email
        WHERE user_id = NEW.user_id
          AND email IS DISTINCT FROM NEW.email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- STEP 2: MODIFY EXISTING TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1  employees — DROP deleted_at
-- --------------------------------------------------------------------------
ALTER TABLE employees DROP COLUMN IF EXISTS deleted_at;


-- --------------------------------------------------------------------------
-- 2.2  salaries — net_salary → NOT NULL
-- --------------------------------------------------------------------------
-- Backfill any NULL rows first (set to basic_salary as a safe default)
UPDATE salaries SET net_salary = basic_salary WHERE net_salary IS NULL;

ALTER TABLE salaries ALTER COLUMN net_salary SET NOT NULL;

-- Replace nullable check with non-nullable version
ALTER TABLE salaries DROP CONSTRAINT IF EXISTS chk_salaries_net;
ALTER TABLE salaries ADD CONSTRAINT chk_salaries_net CHECK (net_salary >= 0);


-- --------------------------------------------------------------------------
-- 2.3  RENAME leaves → leave_requests
-- --------------------------------------------------------------------------
ALTER TABLE IF EXISTS leaves RENAME TO leave_requests;

-- Rename indexes
ALTER INDEX IF EXISTS idx_leaves_employee_id RENAME TO idx_leave_requests_employee_id;
ALTER INDEX IF EXISTS idx_leaves_status RENAME TO idx_leave_requests_status;
ALTER INDEX IF EXISTS idx_leaves_dates RENAME TO idx_leave_requests_dates;

-- Rename constraints on leave_requests safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leaves_employee') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT fk_leaves_employee TO fk_leave_requests_employee;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leaves_leave_type') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT fk_leaves_leave_type TO fk_leave_requests_leave_type;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leaves_approved_by') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT fk_leaves_approved_by TO fk_leave_requests_approved_by;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leaves_date_range') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT chk_leaves_date_range TO chk_leave_requests_date_range;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leaves_total_days') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT chk_leaves_total_days TO chk_leave_requests_total_days;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leaves_status') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT chk_leaves_status TO chk_leave_requests_status;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leaves_no_self_approval') THEN
        ALTER TABLE leave_requests RENAME CONSTRAINT chk_leaves_no_self_approval TO chk_leave_requests_no_self_approval;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lah_leave') THEN
        ALTER TABLE leave_approval_history RENAME CONSTRAINT fk_lah_leave TO fk_lah_leave_request;
    END IF;
END $$;

-- Rename trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_leaves_updated_at') THEN
        ALTER TRIGGER set_leaves_updated_at ON leave_requests RENAME TO set_leave_requests_updated_at;
    END IF;
END $$;


-- --------------------------------------------------------------------------
-- 2.4  departments — ADD dept_code
-- --------------------------------------------------------------------------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS dept_code VARCHAR(20);

-- Generate temporary codes for any existing departments (e.g. 'DEPT-1', 'DEPT-2')
UPDATE departments SET dept_code = 'DEPT-' || dept_id WHERE dept_code IS NULL;

ALTER TABLE departments ALTER COLUMN dept_code SET NOT NULL;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS uq_departments_dept_code;
ALTER TABLE departments ADD CONSTRAINT uq_departments_dept_code UNIQUE (dept_code);


-- --------------------------------------------------------------------------
-- 2.5  employee_addresses — FIX address_type constraint
-- --------------------------------------------------------------------------
DELETE FROM employee_addresses WHERE address_type = 'emergency';

ALTER TABLE employee_addresses DROP CONSTRAINT IF EXISTS chk_emp_addr_type;
ALTER TABLE employee_addresses ADD CONSTRAINT chk_emp_addr_type
    CHECK (address_type IN ('current', 'permanent'));


-- --------------------------------------------------------------------------
-- 2.6  projects — ADD project_head_id
-- --------------------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_head_id BIGINT;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_head;
ALTER TABLE projects ADD CONSTRAINT fk_projects_head
    FOREIGN KEY (project_head_id) REFERENCES employees(emp_id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_head_id ON projects(project_head_id);


-- ============================================================================
-- STEP 3: FK DIRECTION REVERSAL (users ↔ employees)
-- ============================================================================
-- Current:  users.emp_id  → employees.emp_id  (user points to employee)
-- Target:   employees.user_id → users.user_id  (employee points to user)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 3.1  Add new columns to users
-- --------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_email VARCHAR(255);

-- Password reset columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_used_at TIMESTAMPTZ;

-- Drop redundant is_superuser column (authorization is handled purely via user_roles)
ALTER TABLE users DROP COLUMN IF EXISTS is_superuser;


-- --------------------------------------------------------------------------
-- 3.2  Add user_id column to employees (initially nullable for migration)
-- --------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id BIGINT;


-- --------------------------------------------------------------------------
-- 3.3  Migrate data using existing users.emp_id link (if column exists)
-- --------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'emp_id'
    ) THEN
        -- Copy email from employees to users, generate display_name
        UPDATE users u
        SET email        = e.email,
            display_name = e.first_name || ' ' || e.last_name
        FROM employees e
        WHERE u.emp_id = e.emp_id
          AND u.email IS NULL;

        -- Set user_id on employees (reverse the link)
        UPDATE employees e
        SET user_id = u.user_id
        FROM users u
        WHERE u.emp_id = e.emp_id
          AND e.user_id IS NULL;

        -- Handle standalone users (superadmins without employee records)
        UPDATE users
        SET email        = 'admin_' || user_id || '@system.local',
            display_name = 'System Admin #' || user_id
        WHERE emp_id IS NULL
          AND email IS NULL;
    END IF;
END $$;

-- Handle display_name for any remaining NULLs
UPDATE users
SET display_name = 'User #' || user_id
WHERE display_name IS NULL;


-- --------------------------------------------------------------------------
-- 3.3b  Auto-create user accounts for employees WITHOUT a linked user
-- --------------------------------------------------------------------------
-- For any employee that still has user_id = NULL, create a user account for them.
INSERT INTO users (email, display_name, password_hash)
SELECT
    e.email,
    e.first_name || ' ' || e.last_name,
    '!!MUST_RESET!!'
FROM employees e
WHERE e.user_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM users u WHERE LOWER(u.email) = LOWER(e.email)
  );

-- Link all remaining employees to their matching user by email
UPDATE employees e
SET user_id = u.user_id
FROM users u
WHERE LOWER(u.email) = LOWER(e.email)
  AND e.user_id IS NULL;


-- --------------------------------------------------------------------------
-- 3.4  Apply NOT NULL, UNIQUE constraints on new columns
-- --------------------------------------------------------------------------

-- users.email → NOT NULL + UNIQUE
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_email;
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- users.display_name → NOT NULL
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

-- secondary_email must differ from primary
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_secondary_email;
ALTER TABLE users ADD CONSTRAINT chk_users_secondary_email
    CHECK (secondary_email IS NULL OR secondary_email != email);

-- employees.user_id → NOT NULL + UNIQUE
ALTER TABLE employees ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS uq_employees_user_id;
ALTER TABLE employees ADD CONSTRAINT uq_employees_user_id UNIQUE (user_id);


-- --------------------------------------------------------------------------
-- 3.5  Add new FK (employees → users), drop old FK (users → employees)
-- --------------------------------------------------------------------------

-- New FK: employees.user_id → users.user_id
ALTER TABLE employees DROP CONSTRAINT IF EXISTS fk_employees_user;
ALTER TABLE employees ADD CONSTRAINT fk_employees_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- Drop old FK and column: users.emp_id (if still present)
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_employee;
ALTER TABLE users DROP COLUMN IF EXISTS emp_id;


-- --------------------------------------------------------------------------
-- 3.6  Attach email sync triggers
-- --------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_employee_email_to_user ON employees;
CREATE TRIGGER trg_sync_employee_email_to_user
    AFTER UPDATE OF email ON employees
    FOR EACH ROW EXECUTE FUNCTION sync_employee_email_to_user();

DROP TRIGGER IF EXISTS trg_sync_user_email_to_employee ON users;
CREATE TRIGGER trg_sync_user_email_to_employee
    AFTER UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION sync_user_email_to_employee();


-- ============================================================================
-- STEP 4: CREATE NEW TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 27: announcements
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    announcement_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    priority        VARCHAR(20) NOT NULL DEFAULT 'normal',
    target_type     VARCHAR(20) NOT NULL,                     -- 'all' or 'department'
    target_dept_id  BIGINT,                                   -- FK → departments (when target_type = 'department')
    posted_by       BIGINT NOT NULL,                          -- FK → employees.emp_id

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,                              -- Auto-hide after this time

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_announcements_dept
        FOREIGN KEY (target_dept_id) REFERENCES departments(dept_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_announcements_posted_by
        FOREIGN KEY (posted_by) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_announcements_target_type
        CHECK (target_type IN ('all', 'department')),

    CONSTRAINT chk_announcements_dept_required
        CHECK (target_type = 'all' OR target_dept_id IS NOT NULL),

    CONSTRAINT chk_announcements_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    CONSTRAINT chk_announcements_expires
        CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_announcements_target_type ON announcements(target_type);
CREATE INDEX IF NOT EXISTS idx_announcements_target_dept_id ON announcements(target_dept_id);
CREATE INDEX IF NOT EXISTS idx_announcements_posted_by ON announcements(posted_by);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);

DROP TRIGGER IF EXISTS set_announcements_updated_at ON announcements;
CREATE TRIGGER set_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 28: notifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    notification_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    notification_type   VARCHAR(30) NOT NULL,                 -- Category of notification
    target_type         VARCHAR(20) NOT NULL,                 -- 'employee', 'department', 'all'
    target_employee_id  BIGINT,                               -- FK → employees (when 'employee')
    target_dept_id      BIGINT,                               -- FK → departments (when 'department')
    created_by          BIGINT,                               -- FK → employees (NULL = system-generated)

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_notifications_target_employee
        FOREIGN KEY (target_employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_target_dept
        FOREIGN KEY (target_dept_id) REFERENCES departments(dept_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notifications_created_by
        FOREIGN KEY (created_by) REFERENCES employees(emp_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_notifications_target_type
        CHECK (target_type IN ('employee', 'department', 'all')),

    CONSTRAINT chk_notifications_employee_required
        CHECK (target_type != 'employee' OR target_employee_id IS NOT NULL),

    CONSTRAINT chk_notifications_dept_required
        CHECK (target_type != 'department' OR target_dept_id IS NOT NULL),

    CONSTRAINT chk_notifications_type
        CHECK (notification_type IN ('leave', 'attendance', 'payroll', 'announcement', 'review', 'general'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_type ON notifications(target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target_employee ON notifications(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_dept ON notifications(target_dept_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);


-- --------------------------------------------------------------------------
-- TABLE 29: notification_recipients (per-employee read/archive tracking)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_recipients (
    recipient_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    notification_id BIGINT NOT NULL,
    emp_id          BIGINT NOT NULL,                          -- FK → employees (the recipient)
    status          VARCHAR(20) NOT NULL DEFAULT 'unread',
    read_at         TIMESTAMPTZ,                              -- When first read

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_nr_notification
        FOREIGN KEY (notification_id) REFERENCES notifications(notification_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_nr_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    -- One delivery per employee per notification
    CONSTRAINT uq_nr_notification_employee UNIQUE (notification_id, emp_id),

    CONSTRAINT chk_nr_status
        CHECK (status IN ('unread', 'read', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_nr_emp_status ON notification_recipients(emp_id, status);
CREATE INDEX IF NOT EXISTS idx_nr_notification_id ON notification_recipients(notification_id);


-- ============================================================================
-- STEP 5: SEED NEW PERMISSIONS
-- ============================================================================

INSERT INTO permissions (permission_name, description) VALUES
    ('announcement:create',  'Create announcements'),
    ('announcement:read',    'View announcements'),
    ('announcement:update',  'Edit announcements'),
    ('announcement:delete',  'Delete announcements'),
    ('notification:create',  'Send notifications'),
    ('notification:read',    'View notifications')
ON CONFLICT (permission_name) DO NOTHING;


-- ============================================================================
-- STEP 6: ASSIGN NEW PERMISSIONS TO EXISTING ROLES
-- ============================================================================

-- Admin gets all new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Admin'
  AND p.permission_name IN (
    'announcement:create', 'announcement:read', 'announcement:update', 'announcement:delete',
    'notification:create', 'notification:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR_Manager gets announcement CRUD + notification send
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'HR_Manager'
  AND p.permission_name IN (
    'announcement:create', 'announcement:read', 'announcement:update', 'announcement:delete',
    'notification:create', 'notification:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department_Head gets announcement create/read + notification send
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Department_Head'
  AND p.permission_name IN (
    'announcement:create', 'announcement:read',
    'notification:create', 'notification:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employee gets read-only access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Employee'
  AND p.permission_name IN (
    'announcement:read', 'notification:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;


COMMIT;
