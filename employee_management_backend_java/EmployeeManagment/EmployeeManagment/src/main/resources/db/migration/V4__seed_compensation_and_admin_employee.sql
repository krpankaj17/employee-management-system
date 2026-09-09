-- ===================================================================
-- Flyway Migration: V4__seed_compensation_and_admin_employee.sql
-- Description:
-- 1. Add custom_permissions and revoked_permissions to users table
-- 2. Link default admin user to an employee profile if not already linked
-- 3. Seed salary structures, salary components, bank details, and
--    payroll runs for enterprise employees
-- ===================================================================

-- 1. Add per-user permission override columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_permissions TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS revoked_permissions TEXT DEFAULT '[]';

-- 2. Ensure Super Administrator has a linked Employee record
DO $$
DECLARE
    v_admin_user_id BIGINT;
    v_admin_emp_id BIGINT;
    v_exec_dept_id BIGINT;
    v_cto_desig_id BIGINT;
BEGIN
    SELECT user_id INTO v_admin_user_id FROM users WHERE email = 'admin@company.com' LIMIT 1;
    SELECT dept_id INTO v_exec_dept_id FROM departments WHERE dept_code = 'DEPT-1' OR dept_name = 'Executive Leadership' LIMIT 1;
    SELECT designation_id INTO v_cto_desig_id FROM designations WHERE title ILIKE '%Chief Technology Officer%' LIMIT 1;

    IF v_admin_user_id IS NOT NULL THEN
        -- Check if employee already exists for this user
        SELECT emp_id INTO v_admin_emp_id FROM employees WHERE user_id = v_admin_user_id LIMIT 1;

        IF v_admin_emp_id IS NULL THEN
            INSERT INTO employees (
                employee_code, first_name, last_name, email, phone,
                joining_date, employee_status, employment_type,
                dept_id, designation_id, is_active, timezone, user_id
            ) VALUES (
                'EMP-0001', 'Super', 'Administrator', 'admin@company.com', '+91 9999900001',
                '2024-01-01', 'active', 'full_time',
                v_exec_dept_id, v_cto_desig_id, true, 'Asia/Kolkata', v_admin_user_id
            ) RETURNING emp_id INTO v_admin_emp_id;
        END IF;
    END IF;
END $$;

-- 3. Seed Salaries for all active employees without salary
DO $$
DECLARE
    r RECORD;
    v_salary_id BIGINT;
    v_basic NUMERIC(12,2);
    v_hra NUMERIC(12,2);
    v_special NUMERIC(12,2);
    v_conveyance NUMERIC(12,2);
    v_pf NUMERIC(12,2);
    v_pt NUMERIC(12,2);
    v_tds NUMERIC(12,2);
    v_net NUMERIC(12,2);
    v_calc_gross NUMERIC(12,2);
    v_calc_ded NUMERIC(12,2);
BEGIN
    FOR r IN SELECT emp_id, employee_code, first_name, last_name FROM employees WHERE is_active = true LOOP
        -- Only insert if employee has no active salary
        IF NOT EXISTS (SELECT 1 FROM salaries WHERE emp_id = r.emp_id) THEN
            -- Differentiate salary slightly by employee id
            IF r.employee_code = 'EMP-0001' THEN
                v_basic := 150000.00;
                v_hra := 75000.00;
                v_special := 50000.00;
                v_conveyance := 15000.00;
                v_pf := 18000.00;
                v_pt := 200.00;
                v_tds := 35000.00;
            ELSE
                v_basic := 75000.00;
                v_hra := 37500.00;
                v_special := 25000.00;
                v_conveyance := 8000.00;
                v_pf := 9000.00;
                v_pt := 200.00;
                v_tds := 12000.00;
            END IF;

            v_net := (v_basic + v_hra + v_special + v_conveyance) - (v_pf + v_pt + v_tds);

            INSERT INTO salaries (
                emp_id, basic_salary, net_salary, currency, effective_from
            ) VALUES (
                r.emp_id, v_basic, v_net, 'INR', '2025-01-01'
            ) RETURNING salary_id INTO v_salary_id;

            -- Components
            INSERT INTO salary_components (salary_id, component_name, component_type, amount) VALUES
                (v_salary_id, 'Basic Salary', 'earning', v_basic),
                (v_salary_id, 'House Rent Allowance (HRA)', 'earning', v_hra),
                (v_salary_id, 'Special Allowance', 'earning', v_special),
                (v_salary_id, 'Conveyance Allowance', 'earning', v_conveyance),
                (v_salary_id, 'Provident Fund (EPF)', 'deduction', v_pf),
                (v_salary_id, 'Professional Tax (PT)', 'deduction', v_pt),
                (v_salary_id, 'Income Tax (TDS)', 'deduction', v_tds);
        END IF;

        -- 4. Seed Bank Details if missing
        IF NOT EXISTS (SELECT 1 FROM bank_details WHERE emp_id = r.emp_id) THEN
            INSERT INTO bank_details (
                emp_id, bank_name, branch_name, account_number, routing_code, account_type, is_primary
            ) VALUES (
                r.emp_id,
                'HDFC Bank Ltd',
                'Koramangala 5th Block, Bengaluru',
                '50100' || LPAD(r.emp_id::text, 9, '0'),
                'HDFC0001234',
                'savings',
                true
            );
        END IF;

        -- 5. Seed Past 2 Months Payroll Runs if missing
        IF NOT EXISTS (SELECT 1 FROM payroll_runs WHERE emp_id = r.emp_id) THEN
            SELECT salary_id, basic_salary, net_salary INTO v_salary_id, v_basic, v_net
            FROM salaries WHERE emp_id = r.emp_id LIMIT 1;

            IF v_salary_id IS NOT NULL THEN
                SELECT COALESCE(SUM(amount), v_basic * 1.5) INTO v_calc_gross
                FROM salary_components WHERE salary_id = v_salary_id AND component_type = 'earning';

                SELECT COALESCE(SUM(amount), v_basic * 0.2) INTO v_calc_ded
                FROM salary_components WHERE salary_id = v_salary_id AND component_type = 'deduction';

                IF v_net IS NULL THEN
                    v_net := v_calc_gross - v_calc_ded;
                END IF;

                -- Month 1 (July 2026)
                INSERT INTO payroll_runs (
                    emp_id, salary_id, pay_period_start, pay_period_end,
                    gross_amount, total_deductions, net_paid, payment_date,
                    payment_status, payment_method, transaction_ref
                ) VALUES (
                    r.emp_id, v_salary_id, '2026-07-01', '2026-07-31',
                    v_calc_gross,
                    v_calc_ded,
                    v_net,
                    '2026-07-31',
                    'paid',
                    'bank_transfer',
                    'TXN-202607-' || LPAD(r.emp_id::text, 6, '0')
                );

                -- Month 2 (August 2026)
                INSERT INTO payroll_runs (
                    emp_id, salary_id, pay_period_start, pay_period_end,
                    gross_amount, total_deductions, net_paid, payment_date,
                    payment_status, payment_method, transaction_ref
                ) VALUES (
                    r.emp_id, v_salary_id, '2026-08-01', '2026-08-31',
                    v_calc_gross,
                    v_calc_ded,
                    v_net,
                    '2026-08-31',
                    'paid',
                    'bank_transfer',
                    'TXN-202608-' || LPAD(r.emp_id::text, 6, '0')
                );
            END IF;
        END IF;
    END LOOP;
END $$;
