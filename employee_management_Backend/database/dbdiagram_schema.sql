-- ============================================================================
-- EMPLOYEE MANAGEMENT SYSTEM — dbdiagram.io Import SQL
-- Version: 2.2 (29 Tables — Pure SQL DDL formatted for dbdiagram.io)
-- 
-- Instructions:
-- In dbdiagram.io: Click "Import" -> "Import from PostgreSQL" -> Paste this code.
-- ============================================================================

CREATE TABLE "addresses" (
  "address_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "street_address" VARCHAR(255) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "state" VARCHAR(100) NOT NULL,
  "country" VARCHAR(100) NOT NULL DEFAULT 'India',
  "pincode" VARCHAR(10) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "designations" (
  "designation_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "title" VARCHAR(150) UNIQUE NOT NULL,
  "grade_level" VARCHAR(20),
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "departments" (
  "dept_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "dept_name" VARCHAR(150) UNIQUE NOT NULL,
  "dept_code" VARCHAR(20) UNIQUE NOT NULL,
  "description" TEXT,
  "head_employee_id" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "roles" (
  "role_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "role_name" VARCHAR(100) UNIQUE NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "permissions" (
  "permission_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "permission_name" VARCHAR(100) UNIQUE NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "role_permissions" (
  "role_id" BIGINT NOT NULL,
  "permission_id" BIGINT NOT NULL,
  "granted_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "users" (
  "user_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "display_name" VARCHAR(200) NOT NULL,
  "secondary_email" VARCHAR(255),
  "password_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login" TIMESTAMPTZ,
  "password_reset_token" VARCHAR(255),
  "password_reset_expires_at" TIMESTAMPTZ,
  "password_reset_used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "user_roles" (
  "user_id" BIGINT NOT NULL,
  "role_id" BIGINT NOT NULL,
  "assigned_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "employees" (
  "emp_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "employee_code" VARCHAR(20) UNIQUE NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "date_of_birth" DATE NOT NULL,
  "gender" VARCHAR(20) NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "phone" VARCHAR(15) UNIQUE NOT NULL,
  "joining_date" DATE NOT NULL,
  "employee_status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "employment_type" VARCHAR(20) NOT NULL DEFAULT 'full_time',
  "user_id" BIGINT UNIQUE NOT NULL,
  "dept_id" BIGINT,
  "designation_id" BIGINT,
  "reporting_manager_id" BIGINT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "employee_addresses" (
  "employee_address_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "employee_id" BIGINT NOT NULL,
  "address_id" BIGINT NOT NULL,
  "address_type" VARCHAR(20) NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_emp_addr_type" UNIQUE ("employee_id", "address_type")
);

CREATE TABLE "emergency_contacts" (
  "contact_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "emp_id" BIGINT NOT NULL,
  "contact_name" VARCHAR(150) NOT NULL,
  "relationship" VARCHAR(50) NOT NULL,
  "phone" VARCHAR(15) NOT NULL,
  "email" VARCHAR(255),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "attendance" (
  "attendance_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "date" DATE NOT NULL,
  "check_in" TIMESTAMPTZ,
  "check_out" TIMESTAMPTZ,
  "work_mode" VARCHAR(20) NOT NULL DEFAULT 'in_office',
  "status" VARCHAR(20) NOT NULL DEFAULT 'present',
  "total_hours" DECIMAL DEFAULT 0.00,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_attendance_emp_date" UNIQUE ("emp_id", "date")
);

CREATE TABLE "holidays" (
  "holiday_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "date" DATE NOT NULL,
  "holiday_type" VARCHAR(20) NOT NULL DEFAULT 'company',
  "year" INT NOT NULL,
  "is_optional" BOOLEAN NOT NULL DEFAULT false,
  "applicable_region" VARCHAR(100) NOT NULL DEFAULT 'ALL',
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_holidays_date_type_region" UNIQUE ("date", "holiday_type", "applicable_region")
);

CREATE TABLE "leave_types" (
  "leave_type_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "name" VARCHAR(100) UNIQUE NOT NULL,
  "description" TEXT,
  "max_days_per_year" INT NOT NULL DEFAULT 0,
  "is_paid" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "leave_requests" (
  "leave_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "employee_id" BIGINT NOT NULL,
  "leave_type_id" BIGINT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "total_days" DECIMAL NOT NULL,
  "reason" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "approved_by" BIGINT,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "leave_approval_history" (
  "history_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "leave_id" BIGINT NOT NULL,
  "action_by" BIGINT NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "remarks" TEXT,
  "action_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "employee_leave_balances" (
  "balance_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "employee_id" BIGINT NOT NULL,
  "leave_type_id" BIGINT NOT NULL,
  "year" INT NOT NULL,
  "total_allocated" INT NOT NULL DEFAULT 0,
  "used_leaves" INT NOT NULL DEFAULT 0,
  "remaining_leaves" INT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_elb_emp_type_year" UNIQUE ("employee_id", "leave_type_id", "year")
);

CREATE TABLE "salaries" (
  "salary_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "basic_salary" DECIMAL NOT NULL,
  "net_salary" DECIMAL NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "salary_components" (
  "component_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "salary_id" BIGINT NOT NULL,
  "component_name" VARCHAR(100) NOT NULL,
  "component_type" VARCHAR(20) NOT NULL,
  "amount" DECIMAL NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "bank_details" (
  "bank_detail_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "bank_name" VARCHAR(150) NOT NULL,
  "branch_name" VARCHAR(150),
  "account_number" VARCHAR(34) NOT NULL,
  "routing_code" VARCHAR(20) NOT NULL,
  "account_type" VARCHAR(20) NOT NULL DEFAULT 'savings',
  "is_primary" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "payroll_runs" (
  "payroll_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "salary_id" BIGINT,
  "pay_period_start" DATE NOT NULL,
  "pay_period_end" DATE NOT NULL,
  "gross_amount" DECIMAL NOT NULL DEFAULT 0.00,
  "total_deductions" DECIMAL NOT NULL DEFAULT 0.00,
  "net_paid" DECIMAL NOT NULL DEFAULT 0.00,
  "payment_date" DATE,
  "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "payment_method" VARCHAR(20),
  "transaction_ref" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_payroll_emp_period" UNIQUE ("emp_id", "pay_period_start", "pay_period_end")
);

CREATE TABLE "employee_documents" (
  "document_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "employee_id" BIGINT NOT NULL,
  "document_name" VARCHAR(255) NOT NULL,
  "document_type" VARCHAR(30) NOT NULL,
  "document_url" TEXT NOT NULL,
  "file_size_bytes" BIGINT,
  "uploaded_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "projects" (
  "project_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "project_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "project_head_id" BIGINT,
  "start_date" DATE,
  "end_date" DATE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'planning',
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "project_members" (
  "project_id" BIGINT NOT NULL,
  "employee_id" BIGINT NOT NULL,
  "role_in_project" VARCHAR(100),
  "assigned_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("project_id", "employee_id")
);

CREATE TABLE "performance_reviews" (
  "review_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "reviewer_id" BIGINT NOT NULL,
  "review_period_start" DATE NOT NULL,
  "review_period_end" DATE NOT NULL,
  "rating" DECIMAL,
  "comments" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "announcements" (
  "announcement_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "content" TEXT NOT NULL,
  "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
  "target_type" VARCHAR(20) NOT NULL,
  "target_dept_id" BIGINT,
  "posted_by" BIGINT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "notifications" (
  "notification_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "public_id" UUID UNIQUE NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "notification_type" VARCHAR(30) NOT NULL,
  "target_type" VARCHAR(20) NOT NULL,
  "target_employee_id" BIGINT,
  "target_dept_id" BIGINT,
  "created_by" BIGINT,
  "created_at" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "notification_recipients" (
  "recipient_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "notification_id" BIGINT NOT NULL,
  "emp_id" BIGINT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'unread',
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "uq_nr_notification_employee" UNIQUE ("notification_id", "emp_id")
);

CREATE TABLE "audit_logs" (
  "log_id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "user_id" BIGINT,
  "action" VARCHAR(100) NOT NULL,
  "entity_name" VARCHAR(100) NOT NULL,
  "entity_id" VARCHAR(50),
  "old_values" JSONB,
  "new_values" JSONB,
  "ip_address" VARCHAR(45),
  "created_at" TIMESTAMPTZ NOT NULL
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Core HR
ALTER TABLE "employees" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");
ALTER TABLE "employees" ADD FOREIGN KEY ("dept_id") REFERENCES "departments" ("dept_id");
ALTER TABLE "departments" ADD FOREIGN KEY ("head_employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "employees" ADD FOREIGN KEY ("designation_id") REFERENCES "designations" ("designation_id");
ALTER TABLE "employees" ADD FOREIGN KEY ("reporting_manager_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "employee_addresses" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "employee_addresses" ADD FOREIGN KEY ("address_id") REFERENCES "addresses" ("address_id");
ALTER TABLE "emergency_contacts" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");

-- Auth & RBAC
ALTER TABLE "user_roles" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");
ALTER TABLE "user_roles" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id");
ALTER TABLE "role_permissions" ADD FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id");
ALTER TABLE "role_permissions" ADD FOREIGN KEY ("permission_id") REFERENCES "permissions" ("permission_id");

-- Attendance
ALTER TABLE "attendance" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");

-- Leave Requests
ALTER TABLE "leave_requests" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "leave_requests" ADD FOREIGN KEY ("leave_type_id") REFERENCES "leave_types" ("leave_type_id");
ALTER TABLE "leave_requests" ADD FOREIGN KEY ("approved_by") REFERENCES "employees" ("emp_id");
ALTER TABLE "leave_approval_history" ADD FOREIGN KEY ("leave_id") REFERENCES "leave_requests" ("leave_id");
ALTER TABLE "leave_approval_history" ADD FOREIGN KEY ("action_by") REFERENCES "employees" ("emp_id");
ALTER TABLE "employee_leave_balances" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "employee_leave_balances" ADD FOREIGN KEY ("leave_type_id") REFERENCES "leave_types" ("leave_type_id");

-- Compensation & Payroll
ALTER TABLE "salaries" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "salary_components" ADD FOREIGN KEY ("salary_id") REFERENCES "salaries" ("salary_id");
ALTER TABLE "bank_details" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "payroll_runs" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "payroll_runs" ADD FOREIGN KEY ("salary_id") REFERENCES "salaries" ("salary_id");

-- Documents & Projects
ALTER TABLE "employee_documents" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "projects" ADD FOREIGN KEY ("project_head_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "project_members" ADD FOREIGN KEY ("project_id") REFERENCES "projects" ("project_id");
ALTER TABLE "project_members" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("emp_id");

-- Performance & Audit
ALTER TABLE "performance_reviews" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "performance_reviews" ADD FOREIGN KEY ("reviewer_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "audit_logs" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("user_id");

-- Announcements & Notifications
ALTER TABLE "announcements" ADD FOREIGN KEY ("target_dept_id") REFERENCES "departments" ("dept_id");
ALTER TABLE "announcements" ADD FOREIGN KEY ("posted_by") REFERENCES "employees" ("emp_id");
ALTER TABLE "notifications" ADD FOREIGN KEY ("target_employee_id") REFERENCES "employees" ("emp_id");
ALTER TABLE "notifications" ADD FOREIGN KEY ("target_dept_id") REFERENCES "departments" ("dept_id");
ALTER TABLE "notifications" ADD FOREIGN KEY ("created_by") REFERENCES "employees" ("emp_id");
ALTER TABLE "notification_recipients" ADD FOREIGN KEY ("notification_id") REFERENCES "notifications" ("notification_id");
ALTER TABLE "notification_recipients" ADD FOREIGN KEY ("emp_id") REFERENCES "employees" ("emp_id");
