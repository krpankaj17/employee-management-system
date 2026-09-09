# src/utils/reset_and_seed_db.py
"""
Complete Database Reset and Reseeding Script for Enterprise EMS.
Wipes old test data and populates clean, realistic enterprise records across ALL tables:
- Standardized RBAC Roles and 65 Permissions
- STRICTLY ONE ADMIN: admin@company.com / AdminPassword123!
- 5 Departments & 10 Designations
- 15 Detailed Employee Profiles with addresses, emergency contacts, bank details, and salaries
- 2 Weeks of realistic attendance logs (punches, hours, work modes)
- 6 Leave types, annual leave quotas for 2026, and pending/approved leave requests
- 4 Enterprise projects with assigned members and milestones
- 6 Performance reviews with ratings, manager comments, and goals
- 4 Company-wide announcements
- 10 Indian Gazetted Holidays for 2026
- Security audit logs
"""

import sys
import datetime
from decimal import Decimal
from pathlib import Path

src_dir = Path(__file__).resolve().parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from sqlalchemy import text, select
from database import SessionLocal, engine
from core.security import hash_password
from models.user import User, Role, Permission, RolePermission, UserRole
from models.department import Department
from models.designation import Designation
from models.employee import Employee, EmergencyContact
from models.address import Address, EmployeeAddress
from models.payroll import Salary, SalaryComponent, BankDetail
from models.attendance import Attendance, Holiday
from models.leave import LeaveType, LeaveRequest, EmployeeLeaveBalance, LeaveApprovalHistory
from models.project import Project, ProjectMember
from models.review import PerformanceReview
from models.announcement import Announcement
from models.audit import AuditLog


def reset_database():
    print("\n========================================================")
    print("STEP 1: Truncating all existing tables in employee_management...")
    print("========================================================")
    
    truncate_sql = """
    TRUNCATE TABLE 
        audit_logs,
        employee_documents,
        notification_recipients,
        notifications,
        announcements,
        performance_reviews,
        project_members,
        projects,
        payroll_runs,
        salary_components,
        salaries,
        bank_details,
        attendance,
        leave_approval_history,
        leave_requests,
        employee_leave_balances,
        leave_types,
        emergency_contacts,
        employee_addresses,
        addresses,
        employees,
        designations,
        departments,
        user_roles,
        users,
        email_verifications,
        holidays
    RESTART IDENTITY CASCADE;
    """
    with engine.begin() as conn:
        conn.execute(text(truncate_sql))
    print("[OK] All application tables cleanly truncated and identity sequences reset.")


def seed_all_data():
    db = SessionLocal()
    try:
        print("\n========================================================")
        print("STEP 2: Initializing Standard RBAC Roles & Permissions...")
        print("========================================================")
        
        # Ensure Roles exist
        role_definitions = [
            ("Admin", "Enterprise Super Administrator with global privileges"),
            ("HR_Manager", "Human Resources Manager overseeing workforce, payroll and leaves"),
            ("Department_Head", "Department Executive managing teams, budgets and reviews"),
            ("Project_Manager", "Project Delivery Lead managing sprints, milestones and assignees"),
            ("Employee", "Standard Employee with self-service dashboard privileges"),
        ]
        
        roles_map = {}
        for r_name, r_desc in role_definitions:
            r = db.scalar(select(Role).where(Role.role_name == r_name))
            if not r:
                r = Role(role_name=r_name, description=r_desc)
                db.add(r)
                db.flush()
            roles_map[r_name] = r

        # Ensure Permissions exist
        all_permissions = [
            # User & Auth
            ("user:read", "User Management"), ("user:create", "User Management"),
            ("user:update", "User Management"), ("user:delete", "User Management"),
            ("role:manage", "User Management"),
            # Employees
            ("employee:read", "Employee Management"), ("employee:view", "Employee Management"),
            ("employee:create", "Employee Management"), ("employee:update", "Employee Management"),
            ("employee:delete", "Employee Management"),
            # Departments
            ("department:read", "Department Management"), ("department:view", "Department Management"),
            ("department:create", "Department Management"), ("department:update", "Department Management"),
            ("department:delete", "Department Management"),
            # Designations
            ("designation:read", "Designation Management"), ("designation:view", "Designation Management"),
            ("designation:create", "Designation Management"), ("designation:update", "Designation Management"),
            ("designation:delete", "Designation Management"),
            # Attendance
            ("attendance:read", "Attendance Management"), ("attendance:view", "Attendance Management"),
            ("attendance:create", "Attendance Management"), ("attendance:update", "Attendance Management"),
            ("attendance:delete", "Attendance Management"),
            # Leaves
            ("leave:read", "Leave Management"), ("leave:view", "Leave Management"),
            ("leave:request", "Leave Management"), ("leave:approve", "Leave Management"),
            ("leave:create", "Leave Management"), ("leave:update", "Leave Management"),
            ("leave:delete", "Leave Management"),
            # Payroll & Salaries
            ("payroll:read", "Payroll Management"), ("payroll:view", "Payroll Management"),
            ("payroll:run", "Payroll Management"), ("payroll:update", "Payroll Management"),
            ("payroll:disburse", "Payroll Management"),
            ("salary:read", "Payroll Management"), ("salary:view", "Payroll Management"),
            ("salary:create", "Payroll Management"), ("salary:update", "Payroll Management"),
            ("salary:delete", "Payroll Management"),
            # Projects
            ("project:read", "Project Management"), ("project:view", "Project Management"),
            ("project:create", "Project Management"), ("project:update", "Project Management"),
            ("project:delete", "Project Management"),
            # Reviews
            ("review:read", "Performance Review"), ("review:view", "Performance Review"),
            ("review:create", "Performance Review"), ("review:update", "Performance Review"),
            ("review:delete", "Performance Review"),
            # Announcements
            ("announcement:read", "Communication"), ("announcement:view", "Communication"),
            ("announcement:create", "Communication"), ("announcement:update", "Communication"),
            ("announcement:delete", "Communication"),
            # Documents & Audit
            ("document:read", "Document Management"), ("document:view", "Document Management"),
            ("document:upload", "Document Management"), ("document:verify", "Document Management"),
            ("document:delete", "Document Management"),
            ("audit:read", "System Security"), ("audit:view", "System Security"),
            ("notification:read", "Communication"), ("notification:create", "Communication"),
        ]

        perms_map = {}
        for p_name, p_mod in all_permissions:
            p = db.scalar(select(Permission).where(Permission.permission_name == p_name))
            if not p:
                p = Permission(permission_name=p_name, module=p_mod, description=f"Grants {p_name}")
                db.add(p)
                db.flush()
            perms_map[p_name] = p

        # Map Permissions to Roles
        # Admin gets everything
        for p in perms_map.values():
            if not db.scalar(select(RolePermission).where(RolePermission.role_id == roles_map["Admin"].role_id, RolePermission.permission_id == p.permission_id)):
                db.add(RolePermission(role_id=roles_map["Admin"].role_id, permission_id=p.permission_id))

        # HR Manager permissions
        hr_perms = [
            "employee:read", "employee:view", "employee:create", "employee:update",
            "department:read", "department:view", "designation:read", "designation:view",
            "attendance:read", "attendance:view", "attendance:create", "attendance:update",
            "leave:read", "leave:view", "leave:request", "leave:approve", "leave:create", "leave:update",
            "payroll:read", "payroll:view", "payroll:run", "salary:read", "salary:view", "salary:create", "salary:update",
            "review:read", "review:view", "review:create", "review:update",
            "announcement:read", "announcement:view", "announcement:create", "announcement:update",
            "document:read", "document:view", "document:upload", "document:verify",
            "notification:read", "notification:create"
        ]
        for p_name in hr_perms:
            if p_name in perms_map:
                if not db.scalar(select(RolePermission).where(RolePermission.role_id == roles_map["HR_Manager"].role_id, RolePermission.permission_id == perms_map[p_name].permission_id)):
                    db.add(RolePermission(role_id=roles_map["HR_Manager"].role_id, permission_id=perms_map[p_name].permission_id))

        # Department Head & Project Manager permissions
        mgr_perms = [
            "employee:read", "employee:view", "department:read", "department:view", "designation:read", "designation:view",
            "attendance:read", "attendance:view", "leave:read", "leave:view", "leave:request", "leave:approve",
            "project:read", "project:view", "project:create", "project:update",
            "review:read", "review:view", "review:create", "review:update",
            "announcement:read", "announcement:view", "notification:read"
        ]
        for role_name in ["Department_Head", "Project_Manager"]:
            for p_name in mgr_perms:
                if p_name in perms_map:
                    if not db.scalar(select(RolePermission).where(RolePermission.role_id == roles_map[role_name].role_id, RolePermission.permission_id == perms_map[p_name].permission_id)):
                        db.add(RolePermission(role_id=roles_map[role_name].role_id, permission_id=perms_map[p_name].permission_id))

        # Standard Employee permissions
        emp_perms = [
            "attendance:read", "leave:read", "leave:request", "project:read", "review:read",
            "announcement:read", "announcement:view", "document:read", "document:upload", "notification:read"
        ]
        for p_name in emp_perms:
            if p_name in perms_map:
                if not db.scalar(select(RolePermission).where(RolePermission.role_id == roles_map["Employee"].role_id, RolePermission.permission_id == perms_map[p_name].permission_id)):
                    db.add(RolePermission(role_id=roles_map["Employee"].role_id, permission_id=perms_map[p_name].permission_id))

        db.commit()
        print("[OK] Roles & Permissions successfully aligned.")

        print("\n========================================================")
        print("STEP 3: Populating Departments and Designations...")
        print("========================================================")
        
        dept_data = [
            ("Executive", "EXC", "Executive leadership and corporate strategic governance"),
            ("Engineering", "ENG", "Software engineering, cloud infrastructure and cybersecurity"),
            ("Product Management", "PRD", "Product discovery, user experience research and roadmap design"),
            ("Human Resources", "HRD", "People operations, talent acquisition and employee engagement"),
            ("Finance & Operations", "FIN", "Financial planning, accounting, tax compliance and legal"),
        ]
        
        depts_map = {}
        for d_name, d_code, d_desc in dept_data:
            dept = Department(dept_name=d_name, dept_code=d_code, description=d_desc)
            db.add(dept)
            db.flush()
            depts_map[d_name] = dept

        desig_data = [
            ("Chief Executive Officer", "L10", "Highest ranking corporate officer"),
            ("VP of Engineering", "L9", "Heads engineering strategy, architecture and technical teams"),
            ("Engineering Manager", "L8", "Leads squad sprints, technical delivery and 1-on-1s"),
            ("Staff Cloud Architect", "L7", "Enterprise distributed systems and cloud infrastructure lead"),
            ("Senior Full Stack Developer", "L6", "Builds end-to-end cloud applications"),
            ("Director of Product", "L9", "Drives enterprise product vision and metrics"),
            ("Lead UI/UX Designer", "L7", "Design system lead and product interactions"),
            ("Head of People Operations", "L9", "Directs organizational talent and culture"),
            ("Senior HR Specialist", "L6", "Talent onboarding, payroll operations and compliance"),
            ("Financial Controller", "L8", "Corporate fiscal management and audits"),
        ]

        desigs_map = {}
        for title, grade, desc in desig_data:
            desig = Designation(
                title=title,
                grade_level=grade,
                description=desc,
            )
            db.add(desig)
            db.flush()
            desigs_map[title] = desig

        db.commit()
        print(f"[OK] Created {len(depts_map)} departments and {len(desigs_map)} designations.")

        print("\n========================================================")
        print("STEP 4: Provisioning STRICTLY ONE ADMIN and 14 Employees...")
        print("========================================================")

        admin_pwd_hash = hash_password("AdminPassword123!")
        emp_pwd_hash = hash_password("EmployeePass123!")

        employees_roster = [
            # 1. STRICTLY ONE ADMIN (CEO & Super Admin)
            {
                "email": "admin@company.com",
                "password_hash": admin_pwd_hash,
                "display_name": "Super Admin",
                "role": "Admin",
                "first_name": "Super",
                "last_name": "Admin",
                "gender": "male",
                "phone": "+91 98765 43210",
                "code": "EMP-0001",
                "dob": datetime.date(1985, 4, 12),
                "joining_date": datetime.date(2021, 1, 15),
                "dept": "Executive",
                "designation": "Chief Executive Officer",
                "manager_email": None,
                "basic_salary": Decimal("350000.00"),
                "bank_name": "HDFC Bank",
                "account_number": "50100458921471",
                "routing_code": "HDFC0000128",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "402 Prestige Palms, Indiranagar",
                "pincode": "560038"
            },
            # 2. VP of Engineering (Department Head)
            {
                "email": "rohit.sharma@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Rohit Sharma",
                "role": "Department_Head",
                "first_name": "Rohit",
                "last_name": "Sharma",
                "gender": "male",
                "phone": "+91 98111 22334",
                "code": "EMP-0002",
                "dob": datetime.date(1988, 6, 20),
                "joining_date": datetime.date(2021, 3, 1),
                "dept": "Engineering",
                "designation": "VP of Engineering",
                "manager_email": "admin@company.com",
                "basic_salary": Decimal("240000.00"),
                "bank_name": "ICICI Bank",
                "account_number": "002401589632",
                "routing_code": "ICIC0000024",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "12B Koramangala 4th Block",
                "pincode": "560034"
            },
            # 3. Engineering Manager (Project Manager)
            {
                "email": "priya.nair@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Priya Nair",
                "role": "Project_Manager",
                "first_name": "Priya",
                "last_name": "Nair",
                "gender": "female",
                "phone": "+91 98222 33445",
                "code": "EMP-0003",
                "dob": datetime.date(1990, 8, 14),
                "joining_date": datetime.date(2022, 1, 10),
                "dept": "Engineering",
                "designation": "Engineering Manager",
                "manager_email": "rohit.sharma@company.com",
                "basic_salary": Decimal("180000.00"),
                "bank_name": "State Bank of India",
                "account_number": "30458962145",
                "routing_code": "SBIN0001254",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "78 HSR Layout Sector 2",
                "pincode": "560102"
            },
            # 4. Staff Cloud Architect
            {
                "email": "vikram.aditya@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Vikram Aditya",
                "role": "Employee",
                "first_name": "Vikram",
                "last_name": "Aditya",
                "gender": "male",
                "phone": "+91 98333 44556",
                "code": "EMP-0004",
                "dob": datetime.date(1991, 11, 28),
                "joining_date": datetime.date(2022, 4, 15),
                "dept": "Engineering",
                "designation": "Staff Cloud Architect",
                "manager_email": "priya.nair@company.com",
                "basic_salary": Decimal("165000.00"),
                "bank_name": "Axis Bank",
                "account_number": "91802004589210",
                "routing_code": "UTIB0000180",
                "city": "Hyderabad",
                "state": "Telangana",
                "address": "204 HITEC City Madhapur",
                "pincode": "500081"
            },
            # 5. Senior Full Stack Developer
            {
                "email": "ananya.sen@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Ananya Sen",
                "role": "Employee",
                "first_name": "Ananya",
                "last_name": "Sen",
                "gender": "female",
                "phone": "+91 98444 55667",
                "code": "EMP-0005",
                "dob": datetime.date(1994, 2, 9),
                "joining_date": datetime.date(2022, 8, 1),
                "dept": "Engineering",
                "designation": "Senior Full Stack Developer",
                "manager_email": "priya.nair@company.com",
                "basic_salary": Decimal("125000.00"),
                "bank_name": "HDFC Bank",
                "account_number": "50100984521478",
                "routing_code": "HDFC0000128",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "15 Green Glen Layout, Bellandur",
                "pincode": "560103"
            },
            # 6. Senior Full Stack Developer 2
            {
                "email": "aravind.swamy@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Aravind Swamy",
                "role": "Employee",
                "first_name": "Aravind",
                "last_name": "Swamy",
                "gender": "male",
                "phone": "+91 98555 66778",
                "code": "EMP-0006",
                "dob": datetime.date(1995, 5, 17),
                "joining_date": datetime.date(2023, 2, 1),
                "dept": "Engineering",
                "designation": "Senior Full Stack Developer",
                "manager_email": "priya.nair@company.com",
                "basic_salary": Decimal("115000.00"),
                "bank_name": "ICICI Bank",
                "account_number": "002409852147",
                "routing_code": "ICIC0000024",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "address": "45 OMR Road, Thoraipakkam",
                "pincode": "600097"
            },
            # 7. Director of Product (Department Head)
            {
                "email": "kavita.patel@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Kavita Patel",
                "role": "Department_Head",
                "first_name": "Kavita",
                "last_name": "Patel",
                "gender": "female",
                "phone": "+91 98666 77889",
                "code": "EMP-0007",
                "dob": datetime.date(1989, 7, 23),
                "joining_date": datetime.date(2021, 6, 15),
                "dept": "Product Management",
                "designation": "Director of Product",
                "manager_email": "admin@company.com",
                "basic_salary": Decimal("210000.00"),
                "bank_name": "HDFC Bank",
                "account_number": "50100784521400",
                "routing_code": "HDFC0000128",
                "city": "Mumbai",
                "state": "Maharashtra",
                "address": "501 Bandra West, Hill Road",
                "pincode": "400050"
            },
            # 8. Lead UI/UX Designer
            {
                "email": "neha.verma@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Neha Verma",
                "role": "Employee",
                "first_name": "Neha",
                "last_name": "Verma",
                "gender": "female",
                "phone": "+91 98777 88990",
                "code": "EMP-0008",
                "dob": datetime.date(1993, 10, 11),
                "joining_date": datetime.date(2022, 11, 1),
                "dept": "Product Management",
                "designation": "Lead UI/UX Designer",
                "manager_email": "kavita.patel@company.com",
                "basic_salary": Decimal("130000.00"),
                "bank_name": "Kotak Mahindra Bank",
                "account_number": "781204589214",
                "routing_code": "KKBK0000214",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "88 Whitefield Main Road",
                "pincode": "560066"
            },
            # 9. Head of People Operations (HR Manager)
            {
                "email": "sunita.menon@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Sunita Menon",
                "role": "HR_Manager",
                "first_name": "Sunita",
                "last_name": "Menon",
                "gender": "female",
                "phone": "+91 98888 99001",
                "code": "EMP-0009",
                "dob": datetime.date(1987, 3, 30),
                "joining_date": datetime.date(2021, 2, 1),
                "dept": "Human Resources",
                "designation": "Head of People Operations",
                "manager_email": "admin@company.com",
                "basic_salary": Decimal("195000.00"),
                "bank_name": "State Bank of India",
                "account_number": "30852147896",
                "routing_code": "SBIN0001254",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "22 Sarjapur Road",
                "pincode": "560035"
            },
            # 10. Senior HR Specialist
            {
                "email": "deepak.joshi@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Deepak Joshi",
                "role": "HR_Manager",
                "first_name": "Deepak",
                "last_name": "Joshi",
                "gender": "male",
                "phone": "+91 98999 00112",
                "code": "EMP-0010",
                "dob": datetime.date(1992, 12, 5),
                "joining_date": datetime.date(2022, 5, 15),
                "dept": "Human Resources",
                "designation": "Senior HR Specialist",
                "manager_email": "sunita.menon@company.com",
                "basic_salary": Decimal("95000.00"),
                "bank_name": "Axis Bank",
                "account_number": "91802008542178",
                "routing_code": "UTIB0000180",
                "city": "Pune",
                "state": "Maharashtra",
                "address": "104 Viman Nagar",
                "pincode": "411014"
            },
            # 11. Financial Controller (Department Head)
            {
                "email": "sanjay.gupta@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Sanjay Gupta",
                "role": "Department_Head",
                "first_name": "Sanjay",
                "last_name": "Gupta",
                "gender": "male",
                "phone": "+91 97111 22334",
                "code": "EMP-0011",
                "dob": datetime.date(1986, 9, 18),
                "joining_date": datetime.date(2021, 4, 1),
                "dept": "Finance & Operations",
                "designation": "Financial Controller",
                "manager_email": "admin@company.com",
                "basic_salary": Decimal("205000.00"),
                "bank_name": "HDFC Bank",
                "account_number": "50100852147890",
                "routing_code": "HDFC0000128",
                "city": "New Delhi",
                "state": "Delhi",
                "address": "12 Connaught Place Outer Circle",
                "pincode": "110001"
            },
            # 12. Senior Accountant
            {
                "email": "meera.reddy@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Meera Reddy",
                "role": "Employee",
                "first_name": "Meera",
                "last_name": "Reddy",
                "gender": "female",
                "phone": "+91 97222 33445",
                "code": "EMP-0012",
                "dob": datetime.date(1993, 1, 25),
                "joining_date": datetime.date(2023, 1, 10),
                "dept": "Finance & Operations",
                "designation": "Financial Controller",
                "manager_email": "sanjay.gupta@company.com",
                "basic_salary": Decimal("90000.00"),
                "bank_name": "ICICI Bank",
                "account_number": "002408521400",
                "routing_code": "ICIC0000024",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "67 Malleshwaram 15th Cross",
                "pincode": "560003"
            },
            # 13. Software Engineer
            {
                "email": "karthik.rajan@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Karthik Rajan",
                "role": "Employee",
                "first_name": "Karthik",
                "last_name": "Rajan",
                "gender": "male",
                "phone": "+91 97333 44556",
                "code": "EMP-0013",
                "dob": datetime.date(1996, 4, 3),
                "joining_date": datetime.date(2023, 6, 1),
                "dept": "Engineering",
                "designation": "Senior Full Stack Developer",
                "manager_email": "priya.nair@company.com",
                "basic_salary": Decimal("92000.00"),
                "bank_name": "HDFC Bank",
                "account_number": "50100458921499",
                "routing_code": "HDFC0000128",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "12 JP Nagar 6th Phase",
                "pincode": "560078"
            },
            # 14. Talent Acquisition Associate
            {
                "email": "tanvi.sharma@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Tanvi Sharma",
                "role": "Employee",
                "first_name": "Tanvi",
                "last_name": "Sharma",
                "gender": "female",
                "phone": "+91 97444 55667",
                "code": "EMP-0014",
                "dob": datetime.date(1997, 8, 19),
                "joining_date": datetime.date(2023, 9, 15),
                "dept": "Human Resources",
                "designation": "Senior HR Specialist",
                "manager_email": "sunita.menon@company.com",
                "basic_salary": Decimal("75000.00"),
                "bank_name": "Kotak Mahindra Bank",
                "account_number": "781209632587",
                "routing_code": "KKBK0000214",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "90 Bannerghatta Road",
                "pincode": "560076"
            },
            # 15. DevOps & Cloud Engineer
            {
                "email": "harish.kumar@company.com",
                "password_hash": emp_pwd_hash,
                "display_name": "Harish Kumar",
                "role": "Employee",
                "first_name": "Harish",
                "last_name": "Kumar",
                "gender": "male",
                "phone": "+91 97555 66778",
                "code": "EMP-0015",
                "dob": datetime.date(1995, 10, 31),
                "joining_date": datetime.date(2023, 3, 1),
                "dept": "Engineering",
                "designation": "Staff Cloud Architect",
                "manager_email": "vikram.aditya@company.com",
                "basic_salary": Decimal("105000.00"),
                "bank_name": "State Bank of India",
                "account_number": "30985214789",
                "routing_code": "SBIN0001254",
                "city": "Bengaluru",
                "state": "Karnataka",
                "address": "33 Electronic City Phase 1",
                "pincode": "560100"
            },
        ]

        emp_objects = {}
        for item in employees_roster:
            # 1. Create User
            user = User(
                email=item["email"].lower(),
                display_name=item["display_name"],
                password_hash=item["password_hash"],
                is_active=True,
            )
            db.add(user)
            db.flush()

            # 2. Attach Role (ONLY Admin has Admin role!)
            target_role = roles_map[item["role"]]
            db.add(UserRole(user_id=user.user_id, role_id=target_role.role_id))
            db.flush()

            # 3. Create Employee
            dept = depts_map[item["dept"]]
            desig = desigs_map[item["designation"]]
            emp = Employee(
                user_id=user.user_id,
                employee_code=item["code"],
                first_name=item["first_name"],
                last_name=item["last_name"],
                gender=item["gender"],
                email=item["email"].lower(),
                phone=item["phone"],
                date_of_birth=item["dob"],
                joining_date=item["joining_date"],
                employee_status="active",
                employment_type="full_time",
                dept_id=dept.dept_id,
                designation_id=desig.designation_id,
                is_active=True,
            )
            db.add(emp)
            db.flush()
            emp_objects[item["email"]] = emp

            # 4. Address
            addr = Address(
                street_address=item["address"],
                city=item["city"],
                state=item["state"],
                country="India",
                pincode=item["pincode"],
            )
            db.add(addr)
            db.flush()
            db.add(EmployeeAddress(
                employee_id=emp.emp_id,
                address_id=addr.address_id,
                address_type="current",
                is_primary=True,
            ))

            # 5. Emergency Contact
            db.add(EmergencyContact(
                emp_id=emp.emp_id,
                contact_name=f"{item['first_name']} Kin",
                relationship="Spouse" if item["dob"].year < 1992 else "Parent",
                phone=item["phone"].replace("98", "99"),
                email=f"{item['first_name'].lower()}.emergency@example.com",
                is_primary=True,
            ))

            # 6. Bank Detail
            db.add(BankDetail(
                emp_id=emp.emp_id,
                bank_name=item["bank_name"],
                account_number=item["account_number"],
                routing_code=item["routing_code"],
                account_type="savings",
                is_primary=True,
            ))

            # 7. Salary & Components
            basic = item["basic_salary"]
            hra = Decimal(round(float(basic) * 0.40, 2))
            allowance = Decimal(round(float(basic) * 0.20, 2))
            pf = Decimal("1800.00")
            net = basic + hra + allowance - pf
            sal = Salary(
                emp_id=emp.emp_id,
                basic_salary=basic,
                net_salary=net,
                currency="INR",
                effective_from=item["joining_date"],
            )
            db.add(sal)
            db.flush()
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="Basic Pay", component_type="earning", amount=basic))
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="House Rent Allowance", component_type="earning", amount=hra))
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="Special Allowance", component_type="earning", amount=allowance))
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="Provident Fund", component_type="deduction", amount=Decimal("1800.00")))

        # Link Reporting Managers Hierarchy
        for item in employees_roster:
            mgr_email = item.get("manager_email")
            if mgr_email and mgr_email in emp_objects:
                emp = emp_objects[item["email"]]
                mgr = emp_objects[mgr_email]
                emp.reporting_manager_id = mgr.emp_id
                db.flush()

        # Link Department Heads
        depts_map["Executive"].head_employee_id = emp_objects["admin@company.com"].emp_id
        depts_map["Engineering"].head_employee_id = emp_objects["rohit.sharma@company.com"].emp_id
        depts_map["Product Management"].head_employee_id = emp_objects["kavita.patel@company.com"].emp_id
        depts_map["Human Resources"].head_employee_id = emp_objects["sunita.menon@company.com"].emp_id
        depts_map["Finance & Operations"].head_employee_id = emp_objects["sanjay.gupta@company.com"].emp_id
        db.flush()

        db.commit()
        print(f"[OK] Created {len(employees_roster)} users, employee profiles, bank details, addresses, and salaries.")

        print("\n========================================================")
        print("STEP 5: Populating 2 Weeks of Realistic Attendance...")
        print("========================================================")
        # 10 recent weekdays
        today = datetime.date.today()
        punch_count = 0
        for i in range(1, 15):
            d = today - datetime.timedelta(days=i)
            if d.weekday() >= 5:
                continue  # Skip weekends
            for idx, emp in enumerate(emp_objects.values()):
                # Variation in work modes & check-in times
                work_mode = "wfh" if (idx + i) % 4 == 0 else "in_office"
                status = "present"
                cin_minute = 15 + ((idx * 7) % 35)
                cout_minute = 10 + ((idx * 5) % 40)
                tz = datetime.timezone.utc
                cin = datetime.datetime.combine(d, datetime.time(9, cin_minute), tzinfo=tz)
                cout = datetime.datetime.combine(d, datetime.time(18, cout_minute), tzinfo=tz)
                hours = Decimal("8.50") if (idx + i) % 5 != 0 else Decimal("9.00")
                
                db.add(Attendance(
                    emp_id=emp.emp_id,
                    date=d,
                    status=status,
                    check_in=cin,
                    check_out=cout,
                    total_hours=hours,
                    work_mode=work_mode,
                    notes=f"Regular punch - {work_mode.replace('_', ' ').title()}",
                ))
                punch_count += 1

        db.commit()
        print(f"[OK] Generated {punch_count} attendance records across past 2 weeks.")

        print("\n========================================================")
        print("STEP 6: Populating Leave Types, Balances & Requests...")
        print("========================================================")
        leave_types_data = [
            ("Annual Leave", "Paid annual leave for planned vacation", 18, True, False),
            ("Sick Leave", "Paid medical leave for recovery or illness", 12, True, True),
            ("Casual Leave", "Short casual absence for personal errands", 8, True, False),
            ("Maternity Leave", "Statutory paid maternity leave for new mothers", 180, True, True),
            ("Paternity Leave", "Paid leave for fathers welcoming a newborn", 15, True, False),
            ("Compensatory Off", "Compensatory day off for weekend delivery", 5, True, False),
        ]

        ltypes = []
        for name, desc, max_days, is_paid, req_doc in leave_types_data:
            lt = LeaveType(
                name=name,
                description=desc,
                max_days_per_year=max_days,
                is_paid=is_paid,
            )
            db.add(lt)
            db.flush()
            ltypes.append(lt)

        # Allocate Leave Balances for 2026 for all employees
        for emp in emp_objects.values():
            for lt in ltypes:
                db.add(EmployeeLeaveBalance(
                    employee_id=emp.emp_id,
                    leave_type_id=lt.leave_type_id,
                    total_allocated=lt.max_days_per_year,
                    used_leaves=2 if lt.name == "Casual Leave" else 0,
                    year=2026,
                ))

        # Sample Leave Requests
        sample_emp_1 = emp_objects["ananya.sen@company.com"]
        sample_emp_2 = emp_objects["aravind.swamy@company.com"]
        sample_emp_3 = emp_objects["karthik.rajan@company.com"]
        manager_priya = emp_objects["priya.nair@company.com"]

        reqs = [
            (sample_emp_1, ltypes[0], today + datetime.timedelta(days=7), today + datetime.timedelta(days=10), 4, "Family vacation to Kerala", "approved", manager_priya),
            (sample_emp_2, ltypes[2], today + datetime.timedelta(days=3), today + datetime.timedelta(days=3), 1, "Personal bank and passport appointment", "pending", None),
            (sample_emp_3, ltypes[1], today - datetime.timedelta(days=2), today - datetime.timedelta(days=1), 2, "Viral flu recovery", "approved", manager_priya),
        ]

        for req_emp, lt, s_date, e_date, days, reason, st, approver in reqs:
            lr = LeaveRequest(
                employee_id=req_emp.emp_id,
                leave_type_id=lt.leave_type_id,
                start_date=s_date,
                end_date=e_date,
                total_days=Decimal(days),
                reason=reason,
                status=st,
                approved_by=approver.emp_id if approver else None,
            )
            db.add(lr)
            db.flush()
            if approver and st == "approved":
                db.add(LeaveApprovalHistory(
                    leave_id=lr.leave_id,
                    action_by=approver.emp_id,
                    action="approved",
                    remarks="Approved by manager",
                    action_at=datetime.datetime.now(datetime.timezone.utc),
                ))

        db.commit()
        print(f"[OK] Created {len(ltypes)} leave types, employee balances, and {len(reqs)} active leave requests.")

        print("\n========================================================")
        print("STEP 7: Populating Projects, Reviews, Announcements, Holidays, Audit...")
        print("========================================================")

        # 1. Projects
        projects_data = [
            ("Cloud Migration 2026", "Migrating monolithic on-prem infrastructure to multi-region Kubernetes", "active", today - datetime.timedelta(days=45), today + datetime.timedelta(days=90), emp_objects["priya.nair@company.com"].emp_id),
            ("Customer Portal v2", "Redesigning client dashboard with modern responsive UI and SSO", "active", today - datetime.timedelta(days=30), today + datetime.timedelta(days=60), emp_objects["kavita.patel@company.com"].emp_id),
            ("AI Automation Pipeline", "Building LLM-powered document extraction and analytics service", "planning", today - datetime.timedelta(days=15), today + datetime.timedelta(days=120), emp_objects["rohit.sharma@company.com"].emp_id),
            ("Enterprise Mobile App", "Cross-platform mobile application for Android and iOS clients", "active", today - datetime.timedelta(days=20), today + datetime.timedelta(days=80), emp_objects["priya.nair@company.com"].emp_id),
        ]

        projs = []
        for p_title, p_desc, p_status, s_date, e_date, head_id in projects_data:
            p = Project(
                project_name=p_title,
                description=p_desc,
                status=p_status,
                start_date=s_date,
                end_date=e_date,
                project_head_id=head_id,
            )
            db.add(p)
            db.flush()
            projs.append(p)

        # Assign team members
        db.add(ProjectMember(project_id=projs[0].project_id, employee_id=emp_objects["priya.nair@company.com"].emp_id, role_in_project="Delivery Lead"))
        db.add(ProjectMember(project_id=projs[0].project_id, employee_id=emp_objects["vikram.aditya@company.com"].emp_id, role_in_project="Cloud Architect"))
        db.add(ProjectMember(project_id=projs[0].project_id, employee_id=emp_objects["harish.kumar@company.com"].emp_id, role_in_project="DevOps Engineer"))
        db.add(ProjectMember(project_id=projs[1].project_id, employee_id=emp_objects["kavita.patel@company.com"].emp_id, role_in_project="Product Lead"))
        db.add(ProjectMember(project_id=projs[1].project_id, employee_id=emp_objects["neha.verma@company.com"].emp_id, role_in_project="UI/UX Designer"))
        db.add(ProjectMember(project_id=projs[1].project_id, employee_id=emp_objects["ananya.sen@company.com"].emp_id, role_in_project="Full Stack Engineer"))

        # 2. Performance Reviews
        reviews_data = [
            (emp_objects["ananya.sen@company.com"], emp_objects["priya.nair@company.com"], datetime.date(2026, 1, 1), datetime.date(2026, 6, 30), Decimal("4.8"), "Consistently delivers high quality features ahead of schedule. Excellent cross-team mentorship.", "finalized"),
            (emp_objects["aravind.swamy@company.com"], emp_objects["priya.nair@company.com"], datetime.date(2026, 1, 1), datetime.date(2026, 6, 30), Decimal("4.5"), "Strong technical problem-solving on microservices and API reliability.", "finalized"),
            (emp_objects["neha.verma@company.com"], emp_objects["kavita.patel@company.com"], datetime.date(2026, 1, 1), datetime.date(2026, 6, 30), Decimal("4.9"), "Outstanding user experience redesign and established unified design tokens.", "finalized"),
            (emp_objects["deepak.joshi@company.com"], emp_objects["sunita.menon@company.com"], datetime.date(2026, 1, 1), datetime.date(2026, 6, 30), Decimal("4.6"), "Smooth execution of quarterly talent onboarding and compliance audits.", "finalized"),
            (emp_objects["harish.kumar@company.com"], emp_objects["vikram.aditya@company.com"], datetime.date(2026, 1, 1), datetime.date(2026, 6, 30), Decimal("4.7"), "Reduced deployment build duration by 40% and improved cluster stability.", "draft"),
        ]

        for r_emp, r_rev, s_date, e_date, score, comments, st in reviews_data:
            db.add(PerformanceReview(
                emp_id=r_emp.emp_id,
                reviewer_id=r_rev.emp_id,
                review_period_start=s_date,
                review_period_end=e_date,
                rating=score,
                comments=comments,
                status=st,
            ))

        # 3. Announcements
        announcements_data = [
            ("Q3 Global All-Hands Meeting", "Join the executive leadership team this Friday at 4 PM IST for our quarterly enterprise updates and roadmap unveil.", "high", "all", emp_objects["admin@company.com"].emp_id),
            ("Annual Performance Appraisal 2026", "The mid-year performance review cycle is now active. Please ensure self-assessments are submitted by the 15th.", "high", "all", emp_objects["sunita.menon@company.com"].emp_id),
            ("Comprehensive Health & Wellness Updates", "We have partnered with new medical providers to expand cashless coverage and mental health wellness sessions.", "normal", "all", emp_objects["sunita.menon@company.com"].emp_id),
            ("Tech Innovation Hackathon - Register Now", "Engineering hackathon begins next month. Form your cross-functional squads and submit project proposals.", "normal", "all", emp_objects["rohit.sharma@company.com"].emp_id),
        ]

        for title, content, priority, audience, author_id in announcements_data:
            db.add(Announcement(
                title=title,
                content=content,
                priority=priority,
                target_type=audience,
                posted_by=author_id,
                is_active=True,
            ))

        # 4. Holidays for 2026
        holidays_data = [
            ("Republic Day", datetime.date(2026, 1, 26), "national"),
            ("Maha Shivratri", datetime.date(2026, 2, 16), "regional"),
            ("Holi", datetime.date(2026, 3, 4), "company"),
            ("Good Friday", datetime.date(2026, 4, 3), "company"),
            ("Eid-ul-Fitr", datetime.date(2026, 3, 21), "company"),
            ("Independence Day", datetime.date(2026, 8, 15), "national"),
            ("Mahatma Gandhi Jayanti", datetime.date(2026, 10, 2), "national"),
            ("Dussehra", datetime.date(2026, 10, 20), "regional"),
            ("Diwali", datetime.date(2026, 11, 8), "company"),
            ("Christmas Day", datetime.date(2026, 12, 25), "company"),
        ]

        for h_name, h_date, h_type in holidays_data:
            db.add(Holiday(
                name=h_name,
                date=h_date,
                holiday_type=h_type,
                year=2026,
            ))

        # 5. Audit Logs
        admin_user = db.scalar(select(User).where(User.email == "admin@company.com"))
        audit_events = [
            ("SYSTEM_BOOTSTRAP", "Database", "1", None, {"status": "Database wiped and reseeded with enterprise dataset"}),
            ("RBAC_PERMISSION_SYNC", "Permissions", "All", None, {"permissions_synced": 65}),
            ("USER_LOGIN_SUCCESS", "Authentication", str(admin_user.public_id), None, {"ip": "127.0.0.1", "auth_method": "password"}),
            ("EMPLOYEE_DIRECTORY_INIT", "Employee", "15", None, {"records_verified": 15}),
        ]

        for action, entity, ent_id, old_v, new_v in audit_events:
            db.add(AuditLog(
                user_id=admin_user.user_id,
                action=action,
                entity_name=entity,
                entity_id=ent_id,
                old_values=old_v,
                new_values=new_v,
            ))

        db.commit()
        print("[OK] Projects, reviews, announcements, holidays and audit logs created.")

        print("\n========================================================")
        print("VERIFICATION: Single Admin User Check")
        print("========================================================")
        admin_users = db.scalars(
            select(User).join(UserRole).join(Role).where(Role.role_name == "Admin")
        ).all()
        print(f"Total Admin Users in DB: {len(admin_users)}")
        for u in admin_users:
            print(f"  -> Admin Email: {u.email} | Display Name: {u.display_name}")
        assert len(admin_users) == 1, f"Expected exactly 1 Admin, but found {len(admin_users)}"

        total_emps = db.scalar(select(text("count(*) from employees")))
        total_attendances = db.scalar(select(text("count(*) from attendance")))
        total_projects = db.scalar(select(text("count(*) from projects")))
        total_reviews = db.scalar(select(text("count(*) from performance_reviews")))
        total_holidays = db.scalar(select(text("count(*) from holidays")))

        print("\n========================================================")
        print("DATABASE SUMMARY AFTER CLEAN RESEED:")
        print("========================================================")
        print(f"  - Total Employees:    {total_emps}")
        print(f"  - Total Attendances:  {total_attendances}")
        print(f"  - Total Projects:     {total_projects}")
        print(f"  - Total Reviews:      {total_reviews}")
        print(f"  - Total Holidays:     {total_holidays}")
        print(f"  - SINGLE ADMIN CREDS: admin@company.com / AdminPassword123!")
        print("========================================================\n")

    finally:
        db.close()


def main():
    reset_database()
    seed_all_data()


if __name__ == "__main__":
    main()
