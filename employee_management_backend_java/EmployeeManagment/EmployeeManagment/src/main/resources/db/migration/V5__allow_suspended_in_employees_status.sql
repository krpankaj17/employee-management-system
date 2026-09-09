-- ===================================================================
-- Flyway Migration: V5__allow_suspended_in_employees_status.sql
-- Description:
-- Update chk_employees_status check constraint to support 'suspended'
-- status and case-insensitive matching for lifecycle transitions.
-- ===================================================================

ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_employees_status;

ALTER TABLE employees ADD CONSTRAINT chk_employees_status CHECK (
    LOWER(employee_status::text) = ANY (ARRAY['active', 'inactive', 'suspended', 'on_leave', 'terminated', 'resigned'])
);
