import { Department, Designation } from "@/types/department";

export const MOCK_DEPARTMENTS: Department[] = [
  {
    public_id: "dept-eng",
    department_name: "Engineering & Technology",
    department_code: "ENG",
    head_employee_public_id: "emp-001",
    head_employee_name: "Arjun Sharma",
    employee_count: 8,
    description: "Core software engineering, architecture, infrastructure and product development.",
  },
  {
    public_id: "dept-hr",
    department_name: "Human Resources",
    department_code: "HR",
    head_employee_public_id: "emp-002",
    head_employee_name: "Priya Mehta",
    employee_count: 3,
    description: "Talent acquisition, employee engagement, workplace compliance and payroll.",
  },
  {
    public_id: "dept-prod",
    department_name: "Product & Design",
    department_code: "PRD",
    head_employee_public_id: "emp-004",
    head_employee_name: "Sneha Iyer",
    employee_count: 4,
    description: "Product management, UX/UI design research, roadmap and feature specification.",
  },
  {
    public_id: "dept-fin",
    department_name: "Finance & Accounting",
    department_code: "FIN",
    head_employee_public_id: "emp-007",
    head_employee_name: "Rajesh Gupta",
    employee_count: 3,
    description: "Financial planning, taxation, audits, disbursements and company accounts.",
  },
  {
    public_id: "dept-ops",
    department_name: "Operations & Admin",
    department_code: "OPS",
    head_employee_public_id: "emp-010",
    head_employee_name: "Meera Nair",
    employee_count: 4,
    description: "Facility operations, IT assets, vendor coordination and workplace logistics.",
  },
];

export const MOCK_DESIGNATIONS: Designation[] = [
  { public_id: "des-01", designation_name: "VP of Engineering", designation_code: "VPE", department_public_id: "dept-eng", department_name: "Engineering & Technology", min_salary: 2200000, max_salary: 3500000 },
  { public_id: "des-02", designation_name: "Senior Software Engineer", designation_code: "SSE", department_public_id: "dept-eng", department_name: "Engineering & Technology", min_salary: 1400000, max_salary: 2000000 },
  { public_id: "des-03", designation_name: "Software Engineer", designation_code: "SE", department_public_id: "dept-eng", department_name: "Engineering & Technology", min_salary: 800000, max_salary: 1300000 },
  { public_id: "des-04", designation_name: "QA Automation Lead", designation_code: "QAL", department_public_id: "dept-eng", department_name: "Engineering & Technology", min_salary: 1100000, max_salary: 1700000 },
  { public_id: "des-05", designation_name: "Head of Human Resources", designation_code: "HHR", department_public_id: "dept-hr", department_name: "Human Resources", min_salary: 1600000, max_salary: 2400000 },
  { public_id: "des-06", designation_name: "HR Executive", designation_code: "HRE", department_public_id: "dept-hr", department_name: "Human Resources", min_salary: 500000, max_salary: 850000 },
  { public_id: "des-07", designation_name: "Principal Product Manager", designation_code: "PPM", department_public_id: "dept-prod", department_name: "Product & Design", min_salary: 1800000, max_salary: 2800000 },
  { public_id: "des-08", designation_name: "Senior UI/UX Designer", designation_code: "UXD", department_public_id: "dept-prod", department_name: "Product & Design", min_salary: 1200000, max_salary: 1800000 },
  { public_id: "des-09", designation_name: "Finance Controller", designation_code: "FC", department_public_id: "dept-fin", department_name: "Finance & Accounting", min_salary: 1500000, max_salary: 2300000 },
  { public_id: "des-10", designation_name: "Operations Lead", designation_code: "OPL", department_public_id: "dept-ops", department_name: "Operations & Admin", min_salary: 900000, max_salary: 1500000 },
];
