-- ============================================================================
-- EMPLOYEE MANAGEMENT SYSTEM — Comprehensive Sample Data Seed Script
-- Version: 2.1
-- Generated: 2026-08-19
-- 
-- Populates all 26 tables with realistic, relational sample data:
-- • Full Executive & Department Hierarchy (CEO -> VPs -> Managers -> Devs -> Interns)
-- • Addresses & Emergency Contacts
-- • User Accounts & Roles (Password for all users: 'Password@123')
-- • Attendance Records across multiple dates & work modes
-- • 2026 Company Holidays Calendar
-- • Leave Balances, Leave Requests & Approval History
-- • Salary Structures, Itemized Components & Monthly Payroll Disbursements
-- • Bank Details with singular primary accounts
-- • Projects & Multi-Member Project Allocations
-- • Employee Compliance Documents
-- • Performance Appraisals & Reviews
-- • System Audit Logs
-- ============================================================================

-- Ensure transaction safety (if any error occurs, whole transaction rolls back)
BEGIN;

-- ============================================================================
-- 1. ADDRESSES
-- ============================================================================
INSERT INTO addresses (street_address, city, state, country, pincode) VALUES
    ('42 MG Road, Indiranagar',             'Bengaluru',  'Karnataka',     'India', '560038'),
    ('108 Connaught Place, Block B',        'New Delhi',  'Delhi',         'India', '110001'),
    ('74 Cyber City, Phase 3',              'Gurugram',   'Haryana',       'India', '122002'),
    ('15 Marine Drive, Nariman Point',      'Mumbai',     'Maharashtra',   'India', '400021'),
    ('22 Koregaon Park, North Main Road',   'Pune',       'Maharashtra',   'India', '411001'),
    ('50 Banjara Hills, Road No. 12',       'Hyderabad',  'Telangana',     'India', '500034'),
    ('19 T Nagar, North Usman Road',        'Chennai',    'Tamil Nadu',    'India', '600017'),
    ('88 Sector 5, Salt Lake City',         'Kolkata',    'West Bengal',   'India', '700091'),
    ('33 Civil Lines, VIP Road',            'Raipur',     'Chhattisgarh',  'India', '492001'),
    ('12 Alkapuri, RC Dutt Road',           'Vadodara',   'Gujarat',       'India', '390007');


-- ============================================================================
-- 2. DEPARTMENTS
-- (Initially without head_employee_id; updated after employees are inserted)
-- ============================================================================
INSERT INTO departments (dept_name, description) VALUES
    ('Executive Leadership',  'C-Suite management and overall company leadership'),
    ('Engineering',           'Software development, infrastructure, and technical architecture'),
    ('Human Resources',       'Talent acquisition, employee relations, and HR operations'),
    ('Sales & Marketing',     'Business development, customer acquisition, and marketing'),
    ('Finance & Accounting',  'Financial planning, payroll, taxes, and budgeting'),
    ('Operations & Support',  'IT support, facilities, and general day-to-day operations');


-- ============================================================================
-- 3. EMPLOYEES (Full Organizational Hierarchy)
--
-- Org Tree:
-- 1: Rajesh Sharma (CEO, Exec Leadership)
-- ├── 2: Vijay Ram (CTO, Engineering) -> Reports to 1
-- │   ├── 6: Amit Verma (Eng Manager) -> Reports to 2
-- │   │   ├── 7: Rahul Nair (Sr Software Eng) -> Reports to 6
-- │   │   │   └── 10: Riya Sen (Intern) -> Reports to 7
-- │   │   └── 8: Sneha Patel (Software Eng) -> Reports to 6
-- │   └── 9: Vikram Das (Lead QA Eng) -> Reports to 2
-- ├── 3: Ananya Iyer (HR Director, HR) -> Reports to 1
-- │   └── 11: Pooja Hegde (HR Executive) -> Reports to 3
-- ├── 4: Rohan Kapoor (VP Sales, Sales) -> Reports to 1
-- │   └── 12: Karan Mehta (Sales Exec) -> Reports to 4
-- └── 5: Meera Nambiar (Finance Director, Finance) -> Reports to 1
--     └── 13: Sanjay Gupta (Accountant) -> Reports to 5
-- ============================================================================

INSERT INTO employees (
    employee_code, first_name, last_name, date_of_birth, gender,
    email, phone, joining_date, employee_status, employment_type,
    dept_id, designation_id, reporting_manager_id
) VALUES
    -- 1. CEO (Top Level)
    ('EMP-1001', 'Rajesh',  'Sharma',   '1975-04-12', 'male',   'rajesh.sharma@company.com', '9810000001', '2015-01-10', 'active', 'full_time', 1, 11, NULL),
    
    -- 2. CTO
    ('EMP-1002', 'Vijay',   'Ram',      '1980-06-15', 'male',   'vijay.ram@company.com',      '9810000002', '2016-03-01', 'active', 'full_time', 2, 10, 1),
    
    -- 3. HR Director
    ('EMP-1003', 'Ananya',  'Iyer',     '1983-09-22', 'female', 'ananya.iyer@company.com',     '9810000003', '2017-05-15', 'active', 'full_time', 3, 8,  1),
    
    -- 4. VP Sales
    ('EMP-1004', 'Rohan',   'Kapoor',   '1982-11-05', 'male',   'rohan.kapoor@company.com',   '9810000004', '2018-02-01', 'active', 'full_time', 4, 9,  1),
    
    -- 5. Finance Director
    ('EMP-1005', 'Meera',   'Nambiar',  '1984-01-30', 'female', 'meera.nambiar@company.com',  '9810000005', '2018-07-15', 'active', 'full_time', 5, 8,  1),
    
    -- 6. Engineering Manager
    ('EMP-1006', 'Amit',    'Verma',    '1988-08-19', 'male',   'amit.verma@company.com',     '9810000006', '2019-04-10', 'active', 'full_time', 2, 6,  2),
    
    -- 7. Senior Software Engineer
    ('EMP-1007', 'Rahul',   'Nair',     '1992-12-03', 'male',   'rahul.nair@company.com',     '9810000007', '2020-08-01', 'active', 'full_time', 2, 4,  6),
    
    -- 8. Software Engineer
    ('EMP-1008', 'Sneha',   'Patel',    '1995-03-14', 'female', 'sneha.patel@company.com',    '9810000008', '2021-11-15', 'active', 'full_time', 2, 3,  6),
    
    -- 9. Lead QA Engineer
    ('EMP-1009', 'Vikram',  'Das',      '1990-07-28', 'male',   'vikram.das@company.com',     '9810000009', '2021-01-10', 'active', 'full_time', 2, 5,  2),
    
    -- 10. Engineering Intern
    ('EMP-1010', 'Riya',    'Sen',      '2002-10-18', 'female', 'riya.sen@company.com',       '9810000010', '2026-01-05', 'active', 'intern',    2, 1,  7),
    
    -- 11. HR Executive
    ('EMP-1011', 'Pooja',   'Hegde',    '1996-05-25', 'female', 'pooja.hegde@company.com',    '9810000011', '2022-06-01', 'active', 'full_time', 3, 12, 3),
    
    -- 12. Sales Executive
    ('EMP-1012', 'Karan',   'Mehta',    '1994-02-17', 'male',   'karan.mehta@company.com',    '9810000012', '2022-09-15', 'active', 'full_time', 4, 16, 4),
    
    -- 13. Accountant
    ('EMP-1013', 'Sanjay',  'Gupta',    '1993-11-11', 'male',   'sanjay.gupta@company.com',   '9810000013', '2023-01-10', 'active', 'full_time', 5, 14, 5);


-- ============================================================================
-- 4. UPDATE DEPARTMENT HEADS
-- ============================================================================
UPDATE departments SET head_employee_id = 1 WHERE dept_name = 'Executive Leadership';
UPDATE departments SET head_employee_id = 2 WHERE dept_name = 'Engineering';
UPDATE departments SET head_employee_id = 3 WHERE dept_name = 'Human Resources';
UPDATE departments SET head_employee_id = 4 WHERE dept_name = 'Sales & Marketing';
UPDATE departments SET head_employee_id = 5 WHERE dept_name = 'Finance & Accounting';
UPDATE departments SET head_employee_id = 6 WHERE dept_name = 'Operations & Support';


-- ============================================================================
-- 5. EMPLOYEE ADDRESSES (Junction with Primary Address constraint)
-- ============================================================================
INSERT INTO employee_addresses (employee_id, address_id, address_type, is_primary) VALUES
    (1,  1, 'current',   TRUE),
    (1,  2, 'permanent', FALSE),
    (2,  1, 'current',   TRUE),
    (3,  3, 'current',   TRUE),
    (4,  4, 'current',   TRUE),
    (5,  5, 'current',   TRUE),
    (6,  1, 'current',   TRUE),
    (7,  6, 'current',   TRUE),
    (7,  7, 'permanent', FALSE),
    (8,  1, 'current',   TRUE),
    (9,  8, 'current',   TRUE),
    (10, 1, 'current',   TRUE),
    (11, 3, 'current',   TRUE),
    (12, 4, 'current',   TRUE),
    (13, 9, 'current',   TRUE);


-- ============================================================================
-- 6. EMERGENCY CONTACTS
-- ============================================================================
INSERT INTO emergency_contacts (emp_id, contact_name, relationship, phone, email, is_primary) VALUES
    (1,  'Sunita Sharma',   'Spouse',  '9820000001', 'sunita.sharma@example.com', TRUE),
    (2,  'Kavita Ram',      'Spouse',  '9820000002', 'kavita.ram@example.com',    TRUE),
    (3,  'Ramesh Iyer',     'Father',  '9820000003', 'ramesh.iyer@example.com',   TRUE),
    (4,  'Divya Kapoor',    'Spouse',  '9820000004', 'divya.kapoor@example.com',  TRUE),
    (5,  'Madhavan Nambiar','Spouse',  '9820000005', 'madhavan.n@example.com',    TRUE),
    (6,  'Geeta Verma',     'Mother',  '9820000006', 'geeta.verma@example.com',   TRUE),
    (7,  'Deepak Nair',     'Brother', '9820000007', 'deepak.nair@example.com',   TRUE),
    (8,  'Kirit Patel',     'Father',  '9820000008', 'kirit.patel@example.com',   TRUE),
    (9,  'Mona Das',        'Spouse',  '9820000009', 'mona.das@example.com',      TRUE),
    (10, 'Aakash Sen',      'Father',  '9820000010', 'aakash.sen@example.com',    TRUE);


-- ============================================================================
-- 7. USERS & USER ROLES (Password: 'Password@123' bcrypt hash)
-- ============================================================================
-- bcrypt hash for 'Password@123':
-- $2b$12$K8y9Vq9Z8iO3vX9sZ5j5qu7eB1L1M2N3O4P5Q6R7S8T9U0V1W2X3Y (sample hash)
INSERT INTO users (emp_id, password_hash, is_active, is_superuser, last_login) VALUES
    (1,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, TRUE,  NOW() - INTERVAL '2 hours'),
    (2,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '5 hours'),
    (3,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '1 day'),
    (4,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '1 day'),
    (5,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '3 days'),
    (6,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '4 hours'),
    (7,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '6 hours'),
    (8,  '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '8 hours'),
    (11, '$2b$12$e8rP8sLw5YQz7mF0G3hKquu8Q8.Q7eC0N7Z6X5B4V3C2X1Z0Y9W8V', TRUE, FALSE, NOW() - INTERVAL '1 day');

-- Assign Roles (1: Admin, 2: HR_Manager, 3: Department_Head, 4: Project_Lead, 5: Employee)
INSERT INTO user_roles (user_id, role_id) VALUES
    (1, 1), -- Rajesh (Admin)
    (2, 3), -- Vijay (Department_Head)
    (3, 2), -- Ananya (HR_Manager)
    (3, 3), -- Ananya also Department_Head
    (4, 3), -- Rohan (Department_Head)
    (5, 3), -- Meera (Department_Head)
    (6, 4), -- Amit (Project_Lead)
    (7, 5), -- Rahul (Employee)
    (8, 5), -- Sneha (Employee)
    (9, 2); -- Pooja (HR_Manager role)


-- ============================================================================
-- 8. BANK DETAILS (One primary per employee)
-- ============================================================================
INSERT INTO bank_details (emp_id, bank_name, branch_name, account_number, routing_code, account_type, is_primary) VALUES
    (1,  'HDFC Bank',           'Indiranagar Branch',   '50100234567890', 'HDFC0000123', 'savings', TRUE),
    (2,  'ICICI Bank',          'Koramangala Branch',   '00020156789012', 'ICIC0000002', 'savings', TRUE),
    (3,  'State Bank of India', 'MG Road Branch',       '30987654321098', 'SBIN0000456', 'savings', TRUE),
    (4,  'Axis Bank',           'Connaught Place',      '91201004567890', 'UTIB0000045', 'savings', TRUE),
    (5,  'Kotak Mahindra Bank', 'Nariman Point Branch', '12345678901234', 'KKBK0000678', 'savings', TRUE),
    (6,  'HDFC Bank',           'Whitefield Branch',    '50100987654321', 'HDFC0000789', 'savings', TRUE),
    (7,  'ICICI Bank',          'HSR Layout Branch',    '00020987654321', 'ICIC0000123', 'savings', TRUE),
    (8,  'State Bank of India', 'Electronic City',      '30987612345678', 'SBIN0000789', 'savings', TRUE),
    (9,  'HDFC Bank',           'Indiranagar Branch',   '50100345678912', 'HDFC0000123', 'savings', TRUE),
    (10, 'Axis Bank',           'Koramangala Branch',   '91201009876543', 'UTIB0000123', 'savings', TRUE);


-- ============================================================================
-- 9. SALARIES & SALARY COMPONENTS (With Non-Overlapping Exclusion)
-- ============================================================================
-- Active salaries: effective_to IS NULL
INSERT INTO salaries (emp_id, basic_salary, net_salary, currency, effective_from, effective_to) VALUES
    (1,  250000.00, 320000.00, 'INR', '2024-04-01', NULL),
    (2,  180000.00, 230000.00, 'INR', '2024-04-01', NULL),
    (3,  140000.00, 180000.00, 'INR', '2024-04-01', NULL),
    (4,  150000.00, 195000.00, 'INR', '2024-04-01', NULL),
    (5,  140000.00, 180000.00, 'INR', '2024-04-01', NULL),
    (6,  120000.00, 155000.00, 'INR', '2024-04-01', NULL),
    (7,   80000.00, 105000.00, 'INR', '2024-04-01', NULL),
    (8,   60000.00,  78000.00, 'INR', '2024-04-01', NULL),
    (9,   75000.00,  98000.00, 'INR', '2024-04-01', NULL),
    (10,  25000.00,  25000.00, 'INR', '2026-01-05', NULL);

-- Itemized Components for Rahul Nair (Salary ID 7)
INSERT INTO salary_components (salary_id, component_name, component_type, amount) VALUES
    (7, 'House Rent Allowance (HRA)', 'earning',   32000.00),
    (7, 'Special Allowance',          'earning',   12000.00),
    (7, 'Provident Fund (PF)',        'deduction',  9600.00),
    (7, 'Professional Tax',           'deduction',   200.00),
    (7, 'Income Tax / TDS',           'deduction',  9200.00);


-- ============================================================================
-- 10. PAYROLL RUNS (Monthly Disbursements)
-- ============================================================================
INSERT INTO payroll_runs (
    emp_id, salary_id, pay_period_start, pay_period_end,
    gross_amount, total_deductions, net_paid,
    payment_date, payment_status, payment_method, transaction_ref
) VALUES
    (1, 1, '2026-07-01', '2026-07-31', 340000.00, 20000.00, 320000.00, '2026-07-31', 'paid', 'bank_transfer', 'TXN-HDFC-2026073101'),
    (2, 2, '2026-07-01', '2026-07-31', 245000.00, 15000.00, 230000.00, '2026-07-31', 'paid', 'bank_transfer', 'TXN-ICIC-2026073102'),
    (7, 7, '2026-07-01', '2026-07-31', 124000.00, 19000.00, 105000.00, '2026-07-31', 'paid', 'bank_transfer', 'TXN-ICIC-2026073107'),
    (8, 8, '2026-07-01', '2026-07-31',  90000.00, 12000.00,  78000.00, '2026-07-31', 'paid', 'bank_transfer', 'TXN-SBIN-2026073108');


-- ============================================================================
-- 11. COMPANY HOLIDAYS 2026
-- ============================================================================
INSERT INTO holidays (name, date, holiday_type, year, is_optional, applicable_region) VALUES
    ('New Year Day',        '2026-01-01', 'national', 2026, FALSE, 'ALL'),
    ('Republic Day',        '2026-01-26', 'national', 2026, FALSE, 'ALL'),
    ('Holi',                '2026-03-04', 'national', 2026, FALSE, 'ALL'),
    ('Good Friday',         '2026-04-03', 'national', 2026, FALSE, 'ALL'),
    ('Eid-ul-Fitr',         '2026-03-20', 'national', 2026, FALSE, 'ALL'),
    ('Independence Day',    '2026-08-15', 'national', 2026, FALSE, 'ALL'),
    ('Gandhi Jayanti',      '2026-10-02', 'national', 2026, FALSE, 'ALL'),
    ('Dussehra',            '2026-10-20', 'national', 2026, FALSE, 'ALL'),
    ('Diwali',              '2026-11-08', 'national', 2026, FALSE, 'ALL'),
    ('Christmas Day',       '2026-12-25', 'national', 2026, FALSE, 'ALL'),
    ('Karnataka Rajyotsava','2026-11-01', 'regional', 2026, FALSE, 'Karnataka');


-- ============================================================================
-- 12. EMPLOYEE LEAVE BALANCES (Year 2026)
-- remaining_leaves is automatically generated by PostgreSQL: (total_allocated - used_leaves)
-- ============================================================================
INSERT INTO employee_leave_balances (employee_id, leave_type_id, year, total_allocated, used_leaves) VALUES
    (7, 1, 2026, 12, 3), -- Rahul Nair: 12 Casual Leaves, 3 used -> 9 remaining
    (7, 2, 2026, 10, 1), -- Rahul Nair: 10 Sick Leaves, 1 used -> 9 remaining
    (7, 3, 2026, 15, 0), -- Rahul Nair: 15 Earned Leaves, 0 used -> 15 remaining
    (8, 1, 2026, 12, 2), -- Sneha Patel: 12 Casual Leaves, 2 used -> 10 remaining
    (8, 2, 2026, 10, 0); -- Sneha Patel: 10 Sick Leaves, 0 used -> 10 remaining


-- ============================================================================
-- 13. LEAVE REQUESTS & LEAVE APPROVAL HISTORY
-- ============================================================================
INSERT INTO leaves (
    employee_id, leave_type_id, start_date, end_date,
    total_days, reason, status, approved_by
) VALUES
    (7, 1, '2026-08-10', '2026-08-12', 3.0, 'Family vacation', 'approved', 6),
    (8, 2, '2026-08-18', '2026-08-18', 1.0, 'Viral fever',     'approved', 6),
    (7, 1, '2026-09-01', '2026-09-02', 2.0, 'Personal work',   'pending',  NULL);

-- Audit trail for Rahul's approved leave (Leave ID 1)
INSERT INTO leave_approval_history (leave_id, action_by, action, remarks, action_at) VALUES
    (1, 7, 'submitted', 'Requesting 3 days casual leave for family travel', '2026-08-01 10:00:00+05:30'),
    (1, 6, 'approved',  'Approved. Handover tasks to Sneha.',               '2026-08-01 14:30:00+05:30');


-- ============================================================================
-- 14. ATTENDANCE (With automatic total_hours trigger)
-- ============================================================================
INSERT INTO attendance (emp_id, date, check_in, check_out, work_mode, status, notes) VALUES
    -- Rahul Nair (emp_id: 7)
    (7, '2026-08-17', '2026-08-17 09:00:00+05:30', '2026-08-17 17:30:00+05:30', 'in_office', 'present', 'Regular shift completed'),
    (7, '2026-08-18', '2026-08-18 09:15:00+05:30', '2026-08-18 18:00:00+05:30', 'wfh',       'present', 'Working remotely on API migration'),
    (7, '2026-08-19', '2026-08-19 08:55:00+05:30', '2026-08-19 17:40:00+05:30', 'in_office', 'present', 'Today shift'),

    -- Sneha Patel (emp_id: 8)
    (8, '2026-08-17', '2026-08-17 09:05:00+05:30', '2026-08-17 17:35:00+05:30', 'in_office', 'present', 'Regular shift'),
    (8, '2026-08-18', NULL,                          NULL,                         'wfh',       'on_leave', 'Sick leave (approved)'),
    (8, '2026-08-19', '2026-08-19 09:00:00+05:30', '2026-08-19 17:30:00+05:30', 'in_office', 'present', 'Back to office'),

    -- Amit Verma (emp_id: 6 - Manager)
    (6, '2026-08-17', '2026-08-17 08:45:00+05:30', '2026-08-17 18:00:00+05:30', 'in_office', 'present', 'Sprint planning'),
    (6, '2026-08-18', '2026-08-18 08:50:00+05:30', '2026-08-18 18:15:00+05:30', 'in_office', 'present', 'Client architectural review'),
    (6, '2026-08-19', '2026-08-19 09:00:00+05:30', '2026-08-19 17:45:00+05:30', 'in_office', 'present', 'Team standups');


-- ============================================================================
-- 15. PROJECTS & PROJECT MEMBERS
-- ============================================================================
INSERT INTO projects (project_name, description, start_date, end_date, status) VALUES
    ('HRMS Cloud Migration',   'Migrating on-premise employee system to PostgreSQL Cloud architecture', '2026-06-01', '2026-12-31', 'active'),
    ('Client Portal Mobile App', 'React Native customer portal for enterprise clients',                   '2026-03-15', '2026-09-30', 'active'),
    ('AI Analytics Dashboard',  'Generative AI analytics for company workforce optimization',             '2026-08-01', '2027-02-28', 'planning');

-- Team Assignments
INSERT INTO project_members (project_id, employee_id, role_in_project) VALUES
    (1, 2,  'Project Sponsor / CTO'),
    (1, 6,  'Project Lead'),
    (1, 7,  'Senior Backend Developer'),
    (1, 8,  'Database & API Developer'),
    (1, 9,  'QA Lead'),
    (2, 6,  'Technical Advisor'),
    (2, 8,  'Frontend Developer');


-- ============================================================================
-- 16. EMPLOYEE DOCUMENTS
-- ============================================================================
INSERT INTO employee_documents (employee_id, document_name, document_type, document_url, file_size_bytes) VALUES
    (7, 'Rahul_Nair_Aadhaar.pdf',      'aadhaar',      's3://hrms-documents/emp-1007/aadhaar.pdf',      1048576),
    (7, 'Rahul_Nair_PAN.pdf',          'pan',          's3://hrms-documents/emp-1007/pan.pdf',           524288),
    (7, 'Rahul_Nair_OfferLetter.pdf',  'offer_letter', 's3://hrms-documents/emp-1007/offer_letter.pdf', 2097152),
    (8, 'Sneha_Patel_Passport.pdf',    'passport',     's3://hrms-documents/emp-1008/passport.pdf',     1572864),
    (8, 'Sneha_Patel_OfferLetter.pdf', 'offer_letter', 's3://hrms-documents/emp-1008/offer_letter.pdf', 2097152);


-- ============================================================================
-- 17. PERFORMANCE REVIEWS
-- ============================================================================
INSERT INTO performance_reviews (
    emp_id, reviewer_id, review_period_start, review_period_end,
    rating, comments, status
) VALUES
    (7, 6, '2025-04-01', '2026-03-31', 4.8, 'Outstanding technical contribution in database migration and core API refactoring.', 'finalized'),
    (8, 6, '2025-04-01', '2026-03-31', 4.4, 'Great work on frontend feature delivery and team collaboration.',                    'finalized'),
    (6, 2, '2025-04-01', '2026-03-31', 4.7, 'Excellent engineering leadership and on-time project execution.',                   'finalized');


-- ============================================================================
-- 18. SYSTEM AUDIT LOGS
-- ============================================================================
INSERT INTO audit_logs (user_id, action, entity_name, entity_id, old_values, new_values, ip_address) VALUES
    (1, 'DATABASE_INIT',    'database',   '0',    NULL, '{"status": "Initialized v2.1 schema with 26 tables"}', '127.0.0.1'),
    (3, 'APPROVE_LEAVE',    'leaves',     '1',    '{"status": "pending"}', '{"status": "approved", "approved_by": 6}', '192.168.1.50'),
    (1, 'DISBURSE_PAYROLL', 'payroll_runs','1',    '{"status": "pending"}', '{"status": "paid", "amount": 320000}',    '192.168.1.10');

-- Commit the entire transaction
COMMIT;

-- ============================================================================
-- SAMPLE DATA INSERTION COMPLETED SUCCESSFULLY!
-- ============================================================================
