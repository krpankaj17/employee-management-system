-- ============================================================================
-- EMPLOYEE MANAGEMENT SYSTEM — PostgreSQL Database Schema
-- Version: 2.2 (with Announcements, Notifications & Revised Auth Flow)
-- Generated: 2026-08-20
-- 
-- Total Tables: 29
-- Strategy: BIGINT IDENTITY (internal PK) + UUID (public-facing ID)
-- ============================================================================

-- ============================================================================
-- STEP 0: CREATE DATABASE & ENABLE EXTENSIONS
-- ============================================================================
-- Run this ONCE from psql connected to the default 'postgres' database:
--
--   CREATE DATABASE employee_management;
--   \c employee_management
--
-- Then run the rest of this script.
-- ============================================================================

-- UUID generation support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- GiST indexing support for exclusion constraints (e.g., non-overlapping date ranges)
CREATE EXTENSION IF NOT EXISTS "btree_gist";


-- ============================================================================
-- STEP 1: GLOBAL TRIGGER FUNCTIONS
-- ============================================================================

-- 1.1 Auto-update `updated_at` timestamp trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.2 Prevent indirect circular manager loops (A -> B -> C -> A)
CREATE OR REPLACE FUNCTION check_manager_hierarchy_cycle()
RETURNS TRIGGER AS $$
DECLARE
    current_mgr BIGINT;
    depth_counter INT := 0;
    max_depth INT := 100;
BEGIN
    IF NEW.reporting_manager_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Direct self-reference check
    IF NEW.reporting_manager_id = NEW.emp_id THEN
        RAISE EXCEPTION 'An employee cannot be their own manager (emp_id: %)', NEW.emp_id;
    END IF;

    -- Recursive check to prevent indirect circular references (A -> B -> ... -> A)
    current_mgr := NEW.reporting_manager_id;
    WHILE current_mgr IS NOT NULL LOOP
        depth_counter := depth_counter + 1;
        IF depth_counter > max_depth THEN
            RAISE EXCEPTION 'Hierarchy depth exceeded % levels or infinite loop detected.', max_depth;
        END IF;

        IF current_mgr = NEW.emp_id THEN
            RAISE EXCEPTION 'Circular manager hierarchy detected: assigning manager_id % to emp_id % creates an organizational loop.', 
                NEW.reporting_manager_id, NEW.emp_id;
        END IF;

        SELECT reporting_manager_id INTO current_mgr
        FROM employees
        WHERE emp_id = current_mgr;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.3 Auto-calculate `total_hours` in attendance from check_in and check_out
CREATE OR REPLACE FUNCTION trigger_calculate_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        NEW.total_hours = ROUND((EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0)::numeric, 2);
    ELSIF NEW.total_hours IS NULL THEN
        NEW.total_hours = 0.00;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.4 Append-only protection for audit logs
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is strictly append-only. UPDATE and DELETE operations are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 1.5 Sync email: employees.email changes → update users.email
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

-- 1.6 Sync email: users.email changes → update employees.email
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
-- STEP 2: CREATE TABLES (in dependency order)
-- ============================================================================

-- ============================================================================
-- MODULE A: CORE HR — Standalone reference tables
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 1: addresses
-- --------------------------------------------------------------------------
CREATE TABLE addresses (
    address_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    street_address  VARCHAR(255) NOT NULL,
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100) NOT NULL,
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode         VARCHAR(10) NOT NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_addresses_pincode CHECK (pincode ~ '^[0-9A-Za-z \-]{3,10}$')
);

CREATE TRIGGER set_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 2: designations
-- --------------------------------------------------------------------------
CREATE TABLE designations (
    designation_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    title           VARCHAR(150) NOT NULL UNIQUE,
    grade_level     VARCHAR(20),                          -- e.g. 'L5', 'Grade-A', 'Band-3'
    description     TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_designations_updated_at
    BEFORE UPDATE ON designations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 3: departments
-- Created WITHOUT head_employee_id FK first (circular dependency with employees).
-- The FK constraint is added in STEP 3 after employees table exists.
-- --------------------------------------------------------------------------
CREATE TABLE departments (
    dept_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    dept_name           VARCHAR(150) NOT NULL UNIQUE,
    dept_code           VARCHAR(20) NOT NULL UNIQUE,          -- e.g. 'ENG', 'HR', 'FIN'
    description         TEXT,
    head_employee_id    BIGINT,                               -- FK added in STEP 3 (DEFERRABLE)

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE B: AUTHENTICATION & RBAC
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 4: roles
-- --------------------------------------------------------------------------
CREATE TABLE roles (
    role_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id   UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    role_name   VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 5: permissions
-- --------------------------------------------------------------------------
CREATE TABLE permissions (
    permission_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    permission_name     VARCHAR(100) NOT NULL UNIQUE,     -- e.g. 'employee:create', 'leave:approve'
    description         TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 6: role_permissions (Junction: roles <-> permissions)
-- --------------------------------------------------------------------------
CREATE TABLE role_permissions (
    role_id         BIGINT NOT NULL,
    permission_id   BIGINT NOT NULL,

    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_perm_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_perm_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
        ON DELETE CASCADE
);

CREATE TRIGGER set_role_permissions_updated_at
    BEFORE UPDATE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 7: users (Authentication profiles)
-- 
-- Flow: Anyone signs up → users row created (email, display_name, password).
--       Admin/HR promotes → employees row created with user_id FK.
--       Login checks users.email directly — no JOIN needed.
-- --------------------------------------------------------------------------
CREATE TABLE users (
    user_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    email           VARCHAR(255) NOT NULL UNIQUE,             -- Login email (synced with employees.email)
    display_name    VARCHAR(200) NOT NULL,                    -- Display name for UI
    secondary_email VARCHAR(255),                             -- Recovery email for forgot password
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,

    -- Password reset
    password_reset_token      VARCHAR(255),                   -- Hashed reset token
    password_reset_expires_at TIMESTAMPTZ,                    -- Token expiry
    password_reset_used_at    TIMESTAMPTZ,                    -- When consumed (prevents reuse)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_secondary_email
        CHECK (secondary_email IS NULL OR secondary_email != email)
);

CREATE INDEX idx_users_email_lower ON users(LOWER(email));

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE C: CORE HR — Employee tables (depends on Module A + B)
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 8: employees (Central Hub Entity)
-- --------------------------------------------------------------------------
CREATE TABLE employees (
    emp_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    employee_code           VARCHAR(20) NOT NULL UNIQUE,      -- e.g. 'EMP-1001'
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    date_of_birth           DATE NOT NULL,
    gender                  VARCHAR(20) NOT NULL,
    email                   VARCHAR(255) NOT NULL UNIQUE,     -- Synced with users.email
    phone                   VARCHAR(15) NOT NULL UNIQUE,
    joining_date            DATE NOT NULL,
    employee_status         VARCHAR(20) NOT NULL DEFAULT 'active',
    employment_type         VARCHAR(20) NOT NULL DEFAULT 'full_time',

    -- Foreign Keys
    user_id                 BIGINT NOT NULL UNIQUE,           -- FK → users.user_id
    dept_id                 BIGINT,
    designation_id          BIGINT,
    reporting_manager_id    BIGINT,                           -- Self-referencing FK

    -- Soft-delete
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign Key Constraints
    CONSTRAINT fk_employees_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_employees_department
        FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_employees_designation
        FOREIGN KEY (designation_id) REFERENCES designations(designation_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_employees_reporting_manager
        FOREIGN KEY (reporting_manager_id) REFERENCES employees(emp_id)
        ON DELETE SET NULL,

    -- Check Constraints
    CONSTRAINT chk_employees_dob
        CHECK (date_of_birth < CURRENT_DATE),

    CONSTRAINT chk_employees_joining_age
        CHECK (joining_date >= date_of_birth + INTERVAL '18 years'),

    CONSTRAINT chk_employees_status
        CHECK (employee_status IN ('active', 'inactive', 'on_leave', 'terminated', 'resigned')),

    CONSTRAINT chk_employees_employment_type
        CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern')),

    CONSTRAINT chk_employees_gender
        CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),

    CONSTRAINT chk_employees_self_manager
        CHECK (reporting_manager_id IS NULL OR reporting_manager_id != emp_id)
);

-- Indexes for frequently queried columns
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_dept_id ON employees(dept_id);
CREATE INDEX idx_employees_designation_id ON employees(designation_id);
CREATE INDEX idx_employees_reporting_manager_id ON employees(reporting_manager_id);
CREATE INDEX idx_employees_status ON employees(employee_status);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_employees_email_lower ON employees(LOWER(email));

CREATE TRIGGER set_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Trigger preventing A -> B -> A or multi-level manager hierarchy cycles
CREATE TRIGGER trg_check_employee_manager_cycle
    BEFORE INSERT OR UPDATE OF reporting_manager_id ON employees
    FOR EACH ROW EXECUTE FUNCTION check_manager_hierarchy_cycle();

-- Email sync: employees.email → users.email
CREATE TRIGGER trg_sync_employee_email_to_user
    AFTER UPDATE OF email ON employees
    FOR EACH ROW EXECUTE FUNCTION sync_employee_email_to_user();


-- --------------------------------------------------------------------------
-- TABLE 9: employee_addresses (Junction: employees <-> addresses)
-- --------------------------------------------------------------------------
CREATE TABLE employee_addresses (
    employee_address_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    employee_id         BIGINT NOT NULL,
    address_id          BIGINT NOT NULL,
    address_type        VARCHAR(20) NOT NULL,
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_emp_addr_employee
        FOREIGN KEY (employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_emp_addr_address
        FOREIGN KEY (address_id) REFERENCES addresses(address_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_emp_addr_type
        CHECK (address_type IN ('current', 'permanent')),

    -- One address of each type per employee
    CONSTRAINT uq_emp_addr_type UNIQUE (employee_id, address_type)
);

-- Partial Unique Index: Exactly ONE primary address per employee
CREATE UNIQUE INDEX uq_employee_addresses_one_primary 
    ON employee_addresses(employee_id) 
    WHERE is_primary = TRUE;

CREATE TRIGGER set_employee_addresses_updated_at
    BEFORE UPDATE ON employee_addresses
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 10: emergency_contacts
-- --------------------------------------------------------------------------
CREATE TABLE emergency_contacts (
    contact_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    emp_id          BIGINT NOT NULL,
    contact_name    VARCHAR(150) NOT NULL,
    relationship    VARCHAR(50) NOT NULL,                 -- e.g. 'Spouse', 'Parent', 'Sibling'
    phone           VARCHAR(15) NOT NULL,
    email           VARCHAR(255),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_emergency_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE
);

-- Partial Unique Index: Exactly ONE primary emergency contact per employee
CREATE UNIQUE INDEX uq_emergency_contacts_one_primary 
    ON emergency_contacts(emp_id) 
    WHERE is_primary = TRUE;

CREATE INDEX idx_emergency_contacts_emp_id ON emergency_contacts(emp_id);

CREATE TRIGGER set_emergency_contacts_updated_at
    BEFORE UPDATE ON emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 11: user_roles (Junction: users <-> roles — multi-role support)
-- --------------------------------------------------------------------------
CREATE TABLE user_roles (
    user_id     BIGINT NOT NULL,
    role_id     BIGINT NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ON DELETE CASCADE
);

CREATE TRIGGER set_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE D: TIME & ATTENDANCE
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 12: attendance
-- --------------------------------------------------------------------------
CREATE TABLE attendance (
    attendance_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    emp_id          BIGINT NOT NULL,
    date            DATE NOT NULL,
    check_in        TIMESTAMPTZ,
    check_out       TIMESTAMPTZ,
    work_mode       VARCHAR(20) NOT NULL DEFAULT 'in_office',
    status          VARCHAR(20) NOT NULL DEFAULT 'present',
    total_hours     NUMERIC(5,2) DEFAULT 0.00,            -- Auto-calculated via trigger
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_attendance_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    -- Guaranteed singular attendance record per employee per day
    CONSTRAINT uq_attendance_emp_date UNIQUE (emp_id, date),

    -- Check Constraints
    CONSTRAINT chk_attendance_checkout_after_checkin
        CHECK (check_out IS NULL OR check_out > check_in),

    CONSTRAINT chk_attendance_hours
        CHECK (total_hours >= 0 AND total_hours <= 24),

    CONSTRAINT chk_attendance_status
        CHECK (status IN ('present', 'absent', 'half_day', 'late', 'on_leave')),

    CONSTRAINT chk_attendance_work_mode
        CHECK (work_mode IN ('in_office', 'wfh', 'hybrid', 'field'))
);

CREATE INDEX idx_attendance_emp_id ON attendance(emp_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_emp_date ON attendance(emp_id, date);

CREATE TRIGGER set_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-compute total_hours upon check_in / check_out changes
CREATE TRIGGER trg_calculate_attendance_hours
    BEFORE INSERT OR UPDATE OF check_in, check_out ON attendance
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_attendance_hours();


-- --------------------------------------------------------------------------
-- TABLE 13: holidays (Scoped by type & region to allow multiple holiday records per date)
-- --------------------------------------------------------------------------
CREATE TABLE holidays (
    holiday_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    name                VARCHAR(150) NOT NULL,
    date                DATE NOT NULL,
    holiday_type        VARCHAR(20) NOT NULL DEFAULT 'company',
    year                INTEGER NOT NULL,
    is_optional         BOOLEAN NOT NULL DEFAULT FALSE,
    applicable_region   VARCHAR(100) NOT NULL DEFAULT 'ALL',  -- e.g. 'ALL', 'National', 'Karnataka'

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_holidays_type
        CHECK (holiday_type IN ('national', 'regional', 'company', 'optional')),

    CONSTRAINT chk_holidays_year
        CHECK (year >= 2000 AND year <= 2100),

    -- Unique per date + type + region (avoids blocking national + regional holidays on same date)
    CONSTRAINT uq_holidays_date_type_region UNIQUE (date, holiday_type, applicable_region)
);

CREATE INDEX idx_holidays_year ON holidays(year);
CREATE INDEX idx_holidays_date ON holidays(date);

CREATE TRIGGER set_holidays_updated_at
    BEFORE UPDATE ON holidays
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE E: LEAVE MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 14: leave_types
-- --------------------------------------------------------------------------
CREATE TABLE leave_types (
    leave_type_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    name                VARCHAR(100) NOT NULL UNIQUE,     -- e.g. 'Casual Leave', 'Sick Leave'
    description         TEXT,
    max_days_per_year   INTEGER NOT NULL DEFAULT 0,
    is_paid             BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_leave_types_max_days
        CHECK (max_days_per_year >= 0)
);

CREATE TRIGGER set_leave_types_updated_at
    BEFORE UPDATE ON leave_types
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 15: leave_requests (Leave Requests)
-- --------------------------------------------------------------------------
CREATE TABLE leave_requests (
    leave_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    employee_id     BIGINT NOT NULL,
    leave_type_id   BIGINT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    total_days      NUMERIC(4,1) NOT NULL,
    reason          TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_by     BIGINT,                               -- Manager/HR who approved/rejected
    rejection_reason TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_leave_requests_employee
        FOREIGN KEY (employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_leave_requests_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(leave_type_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_requests_approved_by
        FOREIGN KEY (approved_by) REFERENCES employees(emp_id)
        ON DELETE SET NULL,

    -- Check Constraints
    CONSTRAINT chk_leave_requests_date_range
        CHECK (end_date >= start_date),

    CONSTRAINT chk_leave_requests_total_days
        CHECK (total_days > 0),

    CONSTRAINT chk_leave_requests_status
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

    -- Blocks self-approval of leaves
    CONSTRAINT chk_leave_requests_no_self_approval
        CHECK (approved_by IS NULL OR approved_by != employee_id)
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE TRIGGER set_leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 16: leave_approval_history (Audit trail for leave decisions)
-- --------------------------------------------------------------------------
CREATE TABLE leave_approval_history (
    history_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    leave_id    BIGINT NOT NULL,
    action_by   BIGINT NOT NULL,                          -- Employee who took the action
    action      VARCHAR(20) NOT NULL,
    remarks     TEXT,
    action_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_lah_leave_request
        FOREIGN KEY (leave_id) REFERENCES leave_requests(leave_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_lah_action_by
        FOREIGN KEY (action_by) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_lah_action
        CHECK (action IN ('submitted', 'approved', 'rejected', 'escalated', 'cancelled'))
);

CREATE INDEX idx_lah_leave_id ON leave_approval_history(leave_id);


-- --------------------------------------------------------------------------
-- TABLE 17: employee_leave_balances
-- remaining_leaves is a GENERATED column: guarantees remaining = total_allocated - used_leaves
-- --------------------------------------------------------------------------
CREATE TABLE employee_leave_balances (
    balance_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    employee_id         BIGINT NOT NULL,
    leave_type_id       BIGINT NOT NULL,
    year                INTEGER NOT NULL,
    total_allocated     INTEGER NOT NULL DEFAULT 0,
    used_leaves         INTEGER NOT NULL DEFAULT 0,

    -- Auto-computed column: prevents state drift
    remaining_leaves    INTEGER GENERATED ALWAYS AS (total_allocated - used_leaves) STORED,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_elb_employee
        FOREIGN KEY (employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_elb_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(leave_type_id)
        ON DELETE CASCADE,

    -- One balance per employee per leave type per year
    CONSTRAINT uq_elb_emp_type_year UNIQUE (employee_id, leave_type_id, year),

    CONSTRAINT chk_elb_allocated
        CHECK (total_allocated >= 0),

    CONSTRAINT chk_elb_used
        CHECK (used_leaves >= 0 AND used_leaves <= total_allocated)
);

CREATE TRIGGER set_elb_updated_at
    BEFORE UPDATE ON employee_leave_balances
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE F: COMPENSATION & PAYROLL
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 18: salaries (Salary Structures / Revision History)
-- Exclusion constraint prevents overlapping date ranges for the same employee
-- --------------------------------------------------------------------------
CREATE TABLE salaries (
    salary_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    emp_id          BIGINT NOT NULL,
    basic_salary    NUMERIC(12,2) NOT NULL,
    net_salary      NUMERIC(12,2) NOT NULL,               -- Computed: basic + earnings - deductions
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    effective_from  DATE NOT NULL,
    effective_to    DATE,                                  -- NULL = currently active structure

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_salaries_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_salaries_basic
        CHECK (basic_salary >= 0),

    CONSTRAINT chk_salaries_net
        CHECK (net_salary >= 0),

    CONSTRAINT chk_salaries_date_range
        CHECK (effective_to IS NULL OR effective_to >= effective_from),

    -- Exclusion Constraint: Guarantees NO overlapping salary periods for the same employee
    CONSTRAINT excl_salaries_no_overlap
        EXCLUDE USING gist (
            emp_id WITH =,
            daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
        )
);

CREATE INDEX idx_salaries_emp_id ON salaries(emp_id);
CREATE INDEX idx_salaries_effective ON salaries(effective_from, effective_to);

CREATE TRIGGER set_salaries_updated_at
    BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 19: salary_components (Itemized earnings & deductions)
-- --------------------------------------------------------------------------
CREATE TABLE salary_components (
    component_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    salary_id       BIGINT NOT NULL,
    component_name  VARCHAR(100) NOT NULL,                -- e.g. 'HRA', 'Travel Allowance', 'PF'
    component_type  VARCHAR(20) NOT NULL,                 -- 'earning' or 'deduction'
    amount          NUMERIC(12,2) NOT NULL,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sc_salary
        FOREIGN KEY (salary_id) REFERENCES salaries(salary_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_sc_amount
        CHECK (amount >= 0),

    CONSTRAINT chk_sc_type
        CHECK (component_type IN ('earning', 'deduction'))
);

CREATE INDEX idx_salary_components_salary_id ON salary_components(salary_id);

CREATE TRIGGER set_salary_components_updated_at
    BEFORE UPDATE ON salary_components
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 20: bank_details (Supports international IBAN / SWIFT / IFSC)
-- --------------------------------------------------------------------------
CREATE TABLE bank_details (
    bank_detail_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    emp_id          BIGINT NOT NULL,
    bank_name       VARCHAR(150) NOT NULL,
    branch_name     VARCHAR(150),
    account_number  VARCHAR(34) NOT NULL,                 -- Fits IBAN (up to 34 chars) or national formats
    routing_code    VARCHAR(20) NOT NULL,                 -- IFSC (India), SWIFT/BIC, or Routing Number
    account_type    VARCHAR(20) NOT NULL DEFAULT 'savings',
    is_primary      BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bank_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_bank_account_type
        CHECK (account_type IN ('savings', 'current')),

    CONSTRAINT chk_bank_routing_code
        CHECK (LENGTH(routing_code) >= 4)
);

-- Partial Unique Index: Exactly ONE primary bank account per employee
CREATE UNIQUE INDEX uq_bank_details_one_primary 
    ON bank_details(emp_id) 
    WHERE is_primary = TRUE;

CREATE INDEX idx_bank_details_emp_id ON bank_details(emp_id);

CREATE TRIGGER set_bank_details_updated_at
    BEFORE UPDATE ON bank_details
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 21: payroll_runs (Monthly payment disbursements)
-- --------------------------------------------------------------------------
CREATE TABLE payroll_runs (
    payroll_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    emp_id              BIGINT NOT NULL,
    salary_id           BIGINT,                           -- Links to salary structure used
    pay_period_start    DATE NOT NULL,
    pay_period_end      DATE NOT NULL,
    gross_amount        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_deductions    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_paid            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_date        DATE,
    payment_status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method      VARCHAR(20),
    transaction_ref     VARCHAR(100),                     -- Bank transaction reference

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_payroll_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_payroll_salary
        FOREIGN KEY (salary_id) REFERENCES salaries(salary_id)
        ON DELETE SET NULL,

    -- Prevents double payroll disbursement for the exact same employee and pay period
    CONSTRAINT uq_payroll_emp_period 
        UNIQUE (emp_id, pay_period_start, pay_period_end),

    CONSTRAINT chk_payroll_amounts
        CHECK (gross_amount >= 0 AND total_deductions >= 0 AND net_paid >= 0),

    CONSTRAINT chk_payroll_period
        CHECK (pay_period_end >= pay_period_start),

    CONSTRAINT chk_payroll_status
        CHECK (payment_status IN ('pending', 'processed', 'paid', 'failed')),

    CONSTRAINT chk_payroll_method
        CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'cheque', 'cash'))
);

CREATE INDEX idx_payroll_emp_id ON payroll_runs(emp_id);
CREATE INDEX idx_payroll_period ON payroll_runs(pay_period_start, pay_period_end);

CREATE TRIGGER set_payroll_runs_updated_at
    BEFORE UPDATE ON payroll_runs
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE G: DOCUMENT MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 22: employee_documents
-- --------------------------------------------------------------------------
CREATE TABLE employee_documents (
    document_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    employee_id     BIGINT NOT NULL,
    document_name   VARCHAR(255) NOT NULL,
    document_type   VARCHAR(30) NOT NULL,
    document_url    TEXT NOT NULL,                         -- S3/Blob/local file path
    file_size_bytes BIGINT,

    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_doc_employee
        FOREIGN KEY (employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_doc_type
        CHECK (document_type IN ('aadhaar', 'pan', 'passport', 'resume',
               'offer_letter', 'experience_letter', 'other')),

    CONSTRAINT chk_doc_file_size
        CHECK (file_size_bytes IS NULL OR file_size_bytes > 0)
);

CREATE INDEX idx_documents_employee_id ON employee_documents(employee_id);

CREATE TRIGGER set_employee_documents_updated_at
    BEFORE UPDATE ON employee_documents
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE H: PROJECT MANAGEMENT
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 23: projects
-- --------------------------------------------------------------------------
CREATE TABLE projects (
    project_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    project_name    VARCHAR(200) NOT NULL,
    description     TEXT,
    project_head_id BIGINT,                               -- FK → employees.emp_id
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'planning',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projects_head
        FOREIGN KEY (project_head_id) REFERENCES employees(emp_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_projects_date_range
        CHECK (end_date IS NULL OR end_date >= start_date),

    CONSTRAINT chk_projects_status
        CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled'))
);

CREATE INDEX idx_projects_head_id ON projects(project_head_id);

CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 24: project_members (Junction: projects <-> employees)
-- --------------------------------------------------------------------------
CREATE TABLE project_members (
    project_id      BIGINT NOT NULL,
    employee_id     BIGINT NOT NULL,

    role_in_project VARCHAR(100),                         -- e.g. 'Project Lead', 'Developer'
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (project_id, employee_id),

    CONSTRAINT fk_pm_project
        FOREIGN KEY (project_id) REFERENCES projects(project_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pm_employee
        FOREIGN KEY (employee_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE
);

CREATE TRIGGER set_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE I: PERFORMANCE REVIEWS
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 25: performance_reviews
-- --------------------------------------------------------------------------
CREATE TABLE performance_reviews (
    review_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    emp_id              BIGINT NOT NULL,                  -- Employee being reviewed
    reviewer_id         BIGINT NOT NULL,                  -- Manager conducting the review
    review_period_start DATE NOT NULL,
    review_period_end   DATE NOT NULL,
    rating              NUMERIC(3,1),                     -- e.g. 4.5 out of 5.0
    comments            TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pr_employee
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pr_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES employees(emp_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_pr_rating
        CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),

    CONSTRAINT chk_pr_period
        CHECK (review_period_end >= review_period_start),

    CONSTRAINT chk_pr_status
        CHECK (status IN ('draft', 'submitted', 'acknowledged', 'finalized')),

    -- Employee cannot conduct a performance review of themselves
    CONSTRAINT chk_pr_self_review
        CHECK (emp_id != reviewer_id)
);

CREATE INDEX idx_pr_emp_id ON performance_reviews(emp_id);
CREATE INDEX idx_pr_reviewer_id ON performance_reviews(reviewer_id);

CREATE TRIGGER set_performance_reviews_updated_at
    BEFORE UPDATE ON performance_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================================
-- MODULE J: ANNOUNCEMENTS & NOTIFICATIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 26: announcements
-- --------------------------------------------------------------------------
CREATE TABLE announcements (
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

CREATE INDEX idx_announcements_target_type ON announcements(target_type);
CREATE INDEX idx_announcements_target_dept_id ON announcements(target_dept_id);
CREATE INDEX idx_announcements_posted_by ON announcements(posted_by);
CREATE INDEX idx_announcements_is_active ON announcements(is_active);

CREATE TRIGGER set_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- --------------------------------------------------------------------------
-- TABLE 27: notifications
-- --------------------------------------------------------------------------
CREATE TABLE notifications (
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

CREATE INDEX idx_notifications_target_type ON notifications(target_type);
CREATE INDEX idx_notifications_target_employee ON notifications(target_employee_id);
CREATE INDEX idx_notifications_target_dept ON notifications(target_dept_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);


-- --------------------------------------------------------------------------
-- TABLE 28: notification_recipients (per-employee read/archive tracking)
-- --------------------------------------------------------------------------
CREATE TABLE notification_recipients (
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

-- Fast "get my unread" query
CREATE INDEX idx_nr_emp_status ON notification_recipients(emp_id, status);
CREATE INDEX idx_nr_notification_id ON notification_recipients(notification_id);


-- ============================================================================
-- MODULE K: AUDIT TRAIL
-- ============================================================================

-- --------------------------------------------------------------------------
-- TABLE 29: audit_logs (Strictly Append-Only)
-- --------------------------------------------------------------------------
CREATE TABLE audit_logs (
    log_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id         BIGINT,                               -- User who triggered the action (NULL if system job)
    action          VARCHAR(100) NOT NULL,                 -- e.g. 'UPDATE_SALARY', 'APPROVE_LEAVE'
    entity_name     VARCHAR(100) NOT NULL,                 -- e.g. 'employees', 'salaries'
    entity_id       VARCHAR(50),                           -- PK of the affected row
    old_values      JSONB,                                 -- Snapshot before change
    new_values      JSONB,                                 -- Snapshot after change
    ip_address      VARCHAR(45),                           -- IPv4 or IPv6

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Attach append-only triggers
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();


-- ============================================================================
-- STEP 3: ADD DEFERRED CIRCULAR FK + EMAIL SYNC TRIGGERS
-- ============================================================================

-- Circular FK: departments.head_employee_id → employees.emp_id (DEFERRABLE)
ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head_employee
    FOREIGN KEY (head_employee_id) REFERENCES employees(emp_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_departments_head_employee_id ON departments(head_employee_id);

-- Email sync trigger: users.email → employees.email
CREATE TRIGGER trg_sync_user_email_to_employee
    AFTER UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION sync_user_email_to_employee();


-- ============================================================================
-- STEP 4: SEED DATA — Default roles, permissions, leave types, designations
-- ============================================================================

-- Default Roles
INSERT INTO roles (role_name, description) VALUES
    ('Admin',           'Full system access — manages all modules and settings'),
    ('HR_Manager',      'Manages employees, leaves, attendance, payroll, and documents'),
    ('Department_Head', 'Manages department-level operations and approvals'),
    ('Project_Lead',    'Manages project assignments and team members'),
    ('Employee',        'Standard employee access — self-service portal');

-- Default Permissions (All 41 seed permissions)
INSERT INTO permissions (permission_name, description) VALUES
    ('employee:create',      'Create new employee records'),
    ('employee:read',        'View employee records'),
    ('employee:update',      'Update employee records'),
    ('employee:delete',      'Delete/deactivate employee records'),
    ('department:create',    'Create new departments'),
    ('department:read',      'View department information'),
    ('department:update',    'Update department information'),
    ('department:delete',    'Delete departments'),
    ('attendance:create',    'Log attendance (check-in/check-out)'),
    ('attendance:read',      'View attendance records'),
    ('attendance:update',    'Modify attendance records'),
    ('attendance:delete',    'Delete attendance records'),
    ('leave:request',        'Submit leave requests'),
    ('leave:approve',        'Approve or reject leave requests'),
    ('leave:read',           'View leave records'),
    ('salary:create',        'Create salary structures'),
    ('salary:read',          'View salary information'),
    ('salary:update',        'Update salary structures'),
    ('payroll:run',          'Execute payroll disbursements'),
    ('payroll:read',         'View payroll records'),
    ('project:create',       'Create new projects'),
    ('project:read',         'View project information'),
    ('project:update',       'Update project details'),
    ('project:delete',       'Delete projects'),
    ('document:upload',      'Upload employee documents'),
    ('document:read',        'View employee documents'),
    ('document:delete',      'Delete employee documents'),
    ('review:create',        'Create performance reviews'),
    ('review:read',          'View performance reviews'),
    ('audit:read',           'View audit logs'),
    ('user:create',          'Create user accounts'),
    ('user:read',            'View user accounts'),
    ('user:update',          'Update user accounts'),
    ('user:delete',          'Delete user accounts'),
    ('role:manage',          'Manage roles and permissions'),
    ('announcement:create',  'Create announcements'),
    ('announcement:read',    'View announcements'),
    ('announcement:update',  'Edit announcements'),
    ('announcement:delete',  'Delete announcements'),
    ('notification:create',  'Send notifications'),
    ('notification:read',    'View notifications');

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Admin';

-- Assign HR-specific permissions to HR_Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'HR_Manager'
  AND p.permission_name IN (
    'employee:create', 'employee:read', 'employee:update', 'employee:delete',
    'department:read', 'attendance:create', 'attendance:read', 'attendance:update',
    'leave:request', 'leave:approve', 'leave:read',
    'salary:create', 'salary:read', 'salary:update',
    'payroll:run', 'payroll:read',
    'document:upload', 'document:read', 'document:delete',
    'review:create', 'review:read',
    'announcement:create', 'announcement:read', 'announcement:update', 'announcement:delete',
    'notification:create', 'notification:read'
  );

-- Assign Department_Head permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Department_Head'
  AND p.permission_name IN (
    'employee:read', 'employee:update',
    'department:read',
    'attendance:read', 'attendance:update',
    'leave:approve', 'leave:read',
    'project:create', 'project:read', 'project:update',
    'review:create', 'review:read',
    'announcement:create', 'announcement:read',
    'notification:create', 'notification:read'
  );

-- Assign basic permissions to Employee role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'Employee'
  AND p.permission_name IN (
    'employee:read', 'department:read', 'attendance:create', 'attendance:read',
    'leave:request', 'leave:read', 'salary:read', 'payroll:read',
    'project:read', 'document:read', 'review:read',
    'announcement:read', 'notification:read'
  );

-- Default Leave Types
INSERT INTO leave_types (name, description, max_days_per_year, is_paid) VALUES
    ('Casual Leave',        'General purpose leave for personal reasons',            12, TRUE),
    ('Sick Leave',          'Leave due to illness or medical reasons',               10, TRUE),
    ('Earned Leave',        'Accumulated leave based on service duration',           15, TRUE),
    ('Maternity Leave',     'Leave for female employees during pregnancy',          180, TRUE),
    ('Paternity Leave',     'Leave for male employees after child birth',            15, TRUE),
    ('Compensatory Off',    'Leave earned by working on holidays/weekends',           0, TRUE),
    ('Loss of Pay',         'Unpaid leave when all paid leaves are exhausted',        0, FALSE),
    ('Bereavement Leave',   'Leave due to death of an immediate family member',       5, TRUE);

-- Default Designations
INSERT INTO designations (title, grade_level, description) VALUES
    ('Intern',                      'L0',   'Entry-level internship position'),
    ('Junior Software Engineer',    'L1',   'Entry-level engineering role'),
    ('Software Engineer',           'L2',   'Mid-level engineering role'),
    ('Senior Software Engineer',    'L3',   'Senior individual contributor'),
    ('Lead Engineer',               'L4',   'Technical team lead'),
    ('Engineering Manager',         'L5',   'People manager for engineering teams'),
    ('Senior Manager',              'L6',   'Senior management role'),
    ('Director',                    'L7',   'Department director'),
    ('Vice President',              'L8',   'VP-level executive'),
    ('Chief Technology Officer',    'L9',   'C-suite executive — technology'),
    ('Chief Executive Officer',     'L10',  'C-suite executive — company head'),
    ('HR Executive',                'L2',   'Human resources operations'),
    ('HR Manager',                  'L5',   'HR department manager'),
    ('Accountant',                  'L2',   'Finance and accounting role'),
    ('Finance Manager',             'L5',   'Finance department manager'),
    ('Sales Executive',             'L2',   'Sales team member'),
    ('Sales Manager',               'L5',   'Sales department manager'),
    ('Operations Manager',          'L5',   'Operations department manager');


-- ============================================================================
-- STEP 5: VERIFICATION QUERIES
-- ============================================================================

-- List all 29 tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Count tables (should return 29)
-- SELECT COUNT(*) AS total_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Verify email sync (should return 0 rows if in sync)
-- SELECT e.emp_id, e.email AS emp_email, u.email AS user_email
-- FROM employees e JOIN users u ON u.user_id = e.user_id
-- WHERE e.email != u.email;

-- ============================================================================
-- SCHEMA SETUP COMPLETED SUCCESSFULLY!
-- ============================================================================
