# src/utils/seed_data.py
import os
import sys
import datetime
from decimal import Decimal
from pathlib import Path

# Ensure src is on sys.path
src_dir = Path(__file__).resolve().parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from sqlalchemy import select, func, delete
from database import SessionLocal
from core import security
from models.user import User, Role, Permission, RolePermission, UserRole
from models.department import Department
from models.designation import Designation
from models.employee import Employee, EmergencyContact
from models.address import Address, EmployeeAddress
from models.payroll import Salary, SalaryComponent
from models.leave import LeaveType, EmployeeLeaveBalance
from models.attendance import Attendance


def sync_role_permissions(db):
    """Ensures department:read and attendance admin permissions (create, update, delete, read)
    are removed from Employee role and granted strictly to Admin and HR_Manager."""
    print("--> Synchronizing Role Permissions...")
    roles = {r.role_name: r for r in db.query(Role).all()}
    perms = {p.permission_name: p for p in db.query(Permission).all()}

    emp_role = roles.get("Employee")
    hr_role = roles.get("HR_Manager")
    admin_role = roles.get("Admin")

    # 1. Department Read
    dept_read_perm = perms.get("department:read")
    if dept_read_perm and emp_role:
        db.execute(
            delete(RolePermission).where(
                RolePermission.role_id == emp_role.role_id,
                RolePermission.permission_id == dept_read_perm.permission_id,
            )
        )
        print("   [x] Removed 'department:read' from 'Employee' role.")

    if dept_read_perm and hr_role:
        exists = db.scalar(
            select(RolePermission).where(
                RolePermission.role_id == hr_role.role_id,
                RolePermission.permission_id == dept_read_perm.permission_id,
            )
        )
        if not exists:
            db.add(RolePermission(role_id=hr_role.role_id, permission_id=dept_read_perm.permission_id))
            print("   [+] Granted 'department:read' to 'HR_Manager' role.")

    if dept_read_perm and admin_role:
        exists = db.scalar(
            select(RolePermission).where(
                RolePermission.role_id == admin_role.role_id,
                RolePermission.permission_id == dept_read_perm.permission_id,
            )
        )
        if not exists:
            db.add(RolePermission(role_id=admin_role.role_id, permission_id=dept_read_perm.permission_id))
            print("   [+] Granted 'department:read' to 'Admin' role.")

    # 2. Attendance Administrative Permissions (create, update, delete, read/view)
    attendance_admin_perms = ["attendance:create", "attendance:update", "attendance:delete", "attendance:read", "attendance:view"]
    for perm_name in attendance_admin_perms:
        p = perms.get(perm_name)
        if not p:
            continue
        # Strip from Employee
        if emp_role:
            db.execute(
                delete(RolePermission).where(
                    RolePermission.role_id == emp_role.role_id,
                    RolePermission.permission_id == p.permission_id,
                )
            )
        # Grant to HR_Manager
        if hr_role:
            exists = db.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == hr_role.role_id,
                    RolePermission.permission_id == p.permission_id,
                )
            )
            if not exists:
                db.add(RolePermission(role_id=hr_role.role_id, permission_id=p.permission_id))

        # Grant to Admin
        if admin_role:
            exists = db.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == admin_role.role_id,
                    RolePermission.permission_id == p.permission_id,
                )
            )
            if not exists:
                db.add(RolePermission(role_id=admin_role.role_id, permission_id=p.permission_id))

    print("   [x] Removed all administrative attendance permissions from 'Employee' role.")
    print("   [+] Ensured full attendance management permissions for 'Admin' and 'HR_Manager' roles.")
    db.commit()


SEED_EMPLOYEES = [
    # ─── Executive Leadership (DEPT-1) ──────────────────────────────────────────
    {
        "code": "EMP-2001",
        "first_name": "Vikramaditya",
        "last_name": "Rao",
        "email": "vikram.rao@company.com",
        "phone": "+919820010001",
        "dob": datetime.date(1980, 5, 14),
        "joining_date": datetime.date(2016, 2, 1),
        "gender": "male",
        "dept_code": "DEPT-1",
        "designation_title": "Chief Technology Officer",
        "role_name": "Department_Head",
        "manager_email": "rajesh.sharma@company.com",
        "basic_salary": Decimal("350000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "Penthouse 12, Indiranagar 100ft Road",
        "pincode": "560038",
        "contact_name": "Radhika Rao",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090001",
    },
    {
        "code": "EMP-2002",
        "first_name": "Priyadarshini",
        "last_name": "Sundaram",
        "email": "priya.sundaram@company.com",
        "phone": "+919820010002",
        "dob": datetime.date(1982, 8, 20),
        "joining_date": datetime.date(2017, 4, 15),
        "gender": "female",
        "dept_code": "DEPT-1",
        "designation_title": "Vice President",
        "role_name": "Department_Head",
        "manager_email": "rajesh.sharma@company.com",
        "basic_salary": Decimal("300000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "Villa 45, Palm Meadows, Whitefield",
        "pincode": "560066",
        "contact_name": "Sundaram Ramakrishnan",
        "contact_relation": "Father",
        "contact_phone": "+919820090002",
    },

    # ─── Engineering (DEPT-2) ──────────────────────────────────────────────────
    {
        "code": "EMP-2003",
        "first_name": "Arpit",
        "last_name": "Bansal",
        "email": "arpit.bansal@company.com",
        "phone": "+919820010003",
        "dob": datetime.date(1985, 3, 11),
        "joining_date": datetime.date(2018, 1, 10),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Director",
        "role_name": "Department_Head",
        "manager_email": "vikram.rao@company.com",
        "basic_salary": Decimal("240000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "Flat 804, Sobha Quartz, Bellandur",
        "pincode": "560103",
        "contact_name": "Neha Bansal",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090003",
    },
    {
        "code": "EMP-2004",
        "first_name": "Devashish",
        "last_name": "Roy",
        "email": "devashish.roy@company.com",
        "phone": "+919820010004",
        "dob": datetime.date(1987, 11, 25),
        "joining_date": datetime.date(2019, 6, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Engineering Manager",
        "role_name": "Department_Head",
        "manager_email": "arpit.bansal@company.com",
        "basic_salary": Decimal("180000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "302 Green Glen Layout, Bellandur",
        "pincode": "560103",
        "contact_name": "Debabrata Roy",
        "contact_relation": "Father",
        "contact_phone": "+919820090004",
    },
    {
        "code": "EMP-2005",
        "first_name": "Nandini",
        "last_name": "Deshmukh",
        "email": "nandini.deshmukh@company.com",
        "phone": "+919820010005",
        "dob": datetime.date(1988, 7, 19),
        "joining_date": datetime.date(2019, 8, 15),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Engineering Manager",
        "role_name": "Department_Head",
        "manager_email": "arpit.bansal@company.com",
        "basic_salary": Decimal("175000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "701 Prestige Silver Oak, ITPL Main Road",
        "pincode": "560066",
        "contact_name": "Tanmay Deshmukh",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090005",
    },
    {
        "code": "EMP-2006",
        "first_name": "Tarun",
        "last_name": "Bhatia",
        "email": "tarun.bhatia@company.com",
        "phone": "+919820010006",
        "dob": datetime.date(1986, 9, 30),
        "joining_date": datetime.date(2020, 2, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Senior Manager",
        "role_name": "Department_Head",
        "manager_email": "arpit.bansal@company.com",
        "basic_salary": Decimal("165000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "12A Tower 3, Purva Riviera, Marathahalli",
        "pincode": "560037",
        "contact_name": "Simran Bhatia",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090006",
    },
    {
        "code": "EMP-2007",
        "first_name": "Sourav",
        "last_name": "Mukherjee",
        "email": "sourav.mukherjee@company.com",
        "phone": "+919820010007",
        "dob": datetime.date(1989, 4, 12),
        "joining_date": datetime.date(2020, 7, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Lead Engineer",
        "role_name": "Project_Lead",
        "manager_email": "devashish.roy@company.com",
        "basic_salary": Decimal("140000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "404 Alpine Eco Apartments, Doddanekkundi",
        "pincode": "560037",
        "contact_name": "Ananya Mukherjee",
        "contact_relation": "Sister",
        "contact_phone": "+919820090007",
    },
    {
        "code": "EMP-2008",
        "first_name": "Abhishek",
        "last_name": "Kulkarni",
        "email": "abhishek.kulkarni@company.com",
        "phone": "+919820010008",
        "dob": datetime.date(1991, 1, 15),
        "joining_date": datetime.date(2021, 3, 15),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Senior Software Engineer",
        "role_name": "Employee",
        "manager_email": "devashish.roy@company.com",
        "basic_salary": Decimal("115000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "103 Sunrise Residency, HSR Layout Sector 2",
        "pincode": "560102",
        "contact_name": "Shantanu Kulkarni",
        "contact_relation": "Brother",
        "contact_phone": "+919820090008",
    },
    {
        "code": "EMP-2009",
        "first_name": "Kavita",
        "last_name": "Krishnan",
        "email": "kavita.krishnan@company.com",
        "phone": "+919820010009",
        "dob": datetime.date(1992, 10, 8),
        "joining_date": datetime.date(2021, 5, 10),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Senior Software Engineer",
        "role_name": "Employee",
        "manager_email": "devashish.roy@company.com",
        "basic_salary": Decimal("110000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "5B Green Acres, Sarjapur Road",
        "pincode": "560035",
        "contact_name": "S. Krishnan",
        "contact_relation": "Father",
        "contact_phone": "+919820090009",
    },
    {
        "code": "EMP-2010",
        "first_name": "Manasvi",
        "last_name": "Joshi",
        "email": "manasvi.joshi@company.com",
        "phone": "+919820010010",
        "dob": datetime.date(1994, 6, 22),
        "joining_date": datetime.date(2022, 1, 15),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Software Engineer",
        "role_name": "Employee",
        "manager_email": "abhishek.kulkarni@company.com",
        "basic_salary": Decimal("85000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "201 Maple Heights, Koramangala 4th Block",
        "pincode": "560034",
        "contact_name": "Pradeep Joshi",
        "contact_relation": "Father",
        "contact_phone": "+919820090010",
    },
    {
        "code": "EMP-2011",
        "first_name": "Pranav",
        "last_name": "Swaminathan",
        "email": "pranav.swaminathan@company.com",
        "phone": "+919820010011",
        "dob": datetime.date(1996, 12, 5),
        "joining_date": datetime.date(2023, 2, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Junior Software Engineer",
        "role_name": "Employee",
        "manager_email": "abhishek.kulkarni@company.com",
        "basic_salary": Decimal("60000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "12/4 1st Cross, BTM Layout 2nd Stage",
        "pincode": "560076",
        "contact_name": "Lakshmi Swaminathan",
        "contact_relation": "Mother",
        "contact_phone": "+919820090011",
    },
    {
        "code": "EMP-2012",
        "first_name": "Divya",
        "last_name": "Sen",
        "email": "divya.sen@company.com",
        "phone": "+919820010012",
        "dob": datetime.date(1991, 8, 14),
        "joining_date": datetime.date(2021, 4, 1),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Senior Software Engineer",
        "role_name": "Employee",
        "manager_email": "nandini.deshmukh@company.com",
        "basic_salary": Decimal("112000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "304 Mantri Espana, Bellandur Outer Ring Road",
        "pincode": "560103",
        "contact_name": "Subhash Sen",
        "contact_relation": "Father",
        "contact_phone": "+919820090012",
    },
    {
        "code": "EMP-2013",
        "first_name": "Siddharth",
        "last_name": "Menon",
        "email": "siddharth.menon@company.com",
        "phone": "+919820010013",
        "dob": datetime.date(1995, 2, 18),
        "joining_date": datetime.date(2022, 6, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Software Engineer",
        "role_name": "Employee",
        "manager_email": "divya.sen@company.com",
        "basic_salary": Decimal("82000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "402 Silver Spring, Munnekollal, Marathahalli",
        "pincode": "560037",
        "contact_name": "Kishore Menon",
        "contact_relation": "Brother",
        "contact_phone": "+919820090013",
    },
    {
        "code": "EMP-2014",
        "first_name": "Aishwarya",
        "last_name": "Ranganathan",
        "email": "aishwarya.ranganathan@company.com",
        "phone": "+919820010014",
        "dob": datetime.date(1997, 11, 29),
        "joining_date": datetime.date(2023, 7, 10),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Junior Software Engineer",
        "role_name": "Employee",
        "manager_email": "divya.sen@company.com",
        "basic_salary": Decimal("58000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "67 JP Nagar Phase 5, Outer Ring Road",
        "pincode": "560078",
        "contact_name": "Ranganathan Sundar",
        "contact_relation": "Father",
        "contact_phone": "+919820090014",
    },
    {
        "code": "EMP-2015",
        "first_name": "Gautam",
        "last_name": "Das",
        "email": "gautam.das@company.com",
        "phone": "+919820010015",
        "dob": datetime.date(1992, 3, 17),
        "joining_date": datetime.date(2021, 9, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Senior Software Engineer",
        "role_name": "Employee",
        "manager_email": "tarun.bhatia@company.com",
        "basic_salary": Decimal("105000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "15C Lakeview Apartments, Kundalahalli",
        "pincode": "560037",
        "contact_name": "Barnali Das",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090015",
    },
    {
        "code": "EMP-2016",
        "first_name": "Harini",
        "last_name": "Subramanian",
        "email": "harini.subramanian@company.com",
        "phone": "+919820010016",
        "dob": datetime.date(1994, 5, 24),
        "joining_date": datetime.date(2022, 3, 15),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Software Engineer",
        "role_name": "Employee",
        "manager_email": "tarun.bhatia@company.com",
        "basic_salary": Decimal("80000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "22 Trinity Woods, Sarjapur Main Road",
        "pincode": "560035",
        "contact_name": "V. Subramanian",
        "contact_relation": "Father",
        "contact_phone": "+919820090016",
    },
    {
        "code": "EMP-2017",
        "first_name": "Karthik",
        "last_name": "Venkatesh",
        "email": "karthik.venkatesh@company.com",
        "phone": "+919820010017",
        "dob": datetime.date(1993, 12, 10),
        "joining_date": datetime.date(2021, 11, 1),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Software Engineer",
        "role_name": "Employee",
        "manager_email": "sourav.mukherjee@company.com",
        "basic_salary": Decimal("90000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "803 Godrej Eternity, Kanakapura Road",
        "pincode": "560062",
        "contact_name": "Venkatesh Raman",
        "contact_relation": "Father",
        "contact_phone": "+919820090017",
    },
    {
        "code": "EMP-2018",
        "first_name": "Varun",
        "last_name": "Reddy",
        "email": "varun.reddy@company.com",
        "phone": "+919820010018",
        "dob": datetime.date(2001, 4, 18),
        "joining_date": datetime.date(2024, 1, 15),
        "gender": "male",
        "dept_code": "DEPT-2",
        "designation_title": "Intern",
        "role_name": "Employee",
        "manager_email": "sourav.mukherjee@company.com",
        "basic_salary": Decimal("30000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "PG 18, 5th Main, Tavarekere, BTM 1st Stage",
        "pincode": "560029",
        "contact_name": "Srinivas Reddy",
        "contact_relation": "Father",
        "contact_phone": "+919820090018",
    },
    {
        "code": "EMP-2019",
        "first_name": "Shreya",
        "last_name": "Chatterjee",
        "email": "shreya.chatterjee@company.com",
        "phone": "+919820010019",
        "dob": datetime.date(2001, 9, 2),
        "joining_date": datetime.date(2024, 2, 1),
        "gender": "female",
        "dept_code": "DEPT-2",
        "designation_title": "Intern",
        "role_name": "Employee",
        "manager_email": "nandini.deshmukh@company.com",
        "basic_salary": Decimal("30000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "Hostel 3, Electronic City Phase 1",
        "pincode": "560100",
        "contact_name": "Arun Chatterjee",
        "contact_relation": "Father",
        "contact_phone": "+919820090019",
    },

    # ─── Human Resources (DEPT-3) ──────────────────────────────────────────────
    {
        "code": "EMP-2020",
        "first_name": "Pallavi",
        "last_name": "Singhal",
        "email": "pallavi.singhal@company.com",
        "phone": "+919820010020",
        "dob": datetime.date(1990, 7, 21),
        "joining_date": datetime.date(2020, 5, 10),
        "gender": "female",
        "dept_code": "DEPT-3",
        "designation_title": "HR Manager",
        "role_name": "HR_Manager",
        "manager_email": "ananya.iyer@company.com",
        "basic_salary": Decimal("125000.00"),
        "city": "Gurugram",
        "state": "Haryana",
        "address": "B-402 DLF Phase 5, Golf Course Road",
        "pincode": "122009",
        "contact_name": "Mukul Singhal",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090020",
    },
    {
        "code": "EMP-2021",
        "first_name": "Nitin",
        "last_name": "Chawla",
        "email": "nitin.chawla@company.com",
        "phone": "+919820010021",
        "dob": datetime.date(1992, 11, 14),
        "joining_date": datetime.date(2021, 8, 1),
        "gender": "male",
        "dept_code": "DEPT-3",
        "designation_title": "HR Executive",
        "role_name": "HR_Manager",
        "manager_email": "pallavi.singhal@company.com",
        "basic_salary": Decimal("75000.00"),
        "city": "Gurugram",
        "state": "Haryana",
        "address": "112 Sector 46, Near Medanta",
        "pincode": "122003",
        "contact_name": "Sunil Chawla",
        "contact_relation": "Father",
        "contact_phone": "+919820090021",
    },
    {
        "code": "EMP-2022",
        "first_name": "Gayatri",
        "last_name": "Pillai",
        "email": "gayatri.pillai@company.com",
        "phone": "+919820010022",
        "dob": datetime.date(1995, 3, 30),
        "joining_date": datetime.date(2022, 10, 15),
        "gender": "female",
        "dept_code": "DEPT-3",
        "designation_title": "HR Executive",
        "role_name": "Employee",
        "manager_email": "pallavi.singhal@company.com",
        "basic_salary": Decimal("68000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "54 Richmond Town, Victoria Road",
        "pincode": "560025",
        "contact_name": "Madhavan Pillai",
        "contact_relation": "Father",
        "contact_phone": "+919820090022",
    },

    # ─── Sales & Marketing (DEPT-4) ────────────────────────────────────────────
    {
        "code": "EMP-2023",
        "first_name": "Kunal",
        "last_name": "Aggarwal",
        "email": "kunal.aggarwal@company.com",
        "phone": "+919820010023",
        "dob": datetime.date(1987, 2, 8),
        "joining_date": datetime.date(2019, 10, 1),
        "gender": "male",
        "dept_code": "DEPT-4",
        "designation_title": "Sales Manager",
        "role_name": "Department_Head",
        "manager_email": "rohan.kapoor@company.com",
        "basic_salary": Decimal("150000.00"),
        "city": "Mumbai",
        "state": "Maharashtra",
        "address": "1402 Lodha Bellissimo, Mahalaxmi",
        "pincode": "400011",
        "contact_name": "Shilpa Aggarwal",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090023",
    },
    {
        "code": "EMP-2024",
        "first_name": "Smriti",
        "last_name": "Saxena",
        "email": "smriti.saxena@company.com",
        "phone": "+919820010024",
        "dob": datetime.date(1991, 12, 19),
        "joining_date": datetime.date(2021, 6, 1),
        "gender": "female",
        "dept_code": "DEPT-4",
        "designation_title": "Sales Executive",
        "role_name": "Employee",
        "manager_email": "kunal.aggarwal@company.com",
        "basic_salary": Decimal("85000.00"),
        "city": "Mumbai",
        "state": "Maharashtra",
        "address": "503 Raheja Residency, Malad West",
        "pincode": "400064",
        "contact_name": "Alok Saxena",
        "contact_relation": "Father",
        "contact_phone": "+919820090024",
    },
    {
        "code": "EMP-2025",
        "first_name": "Tushar",
        "last_name": "Mahajan",
        "email": "tushar.mahajan@company.com",
        "phone": "+919820010025",
        "dob": datetime.date(1993, 4, 27),
        "joining_date": datetime.date(2022, 4, 15),
        "gender": "male",
        "dept_code": "DEPT-4",
        "designation_title": "Sales Executive",
        "role_name": "Employee",
        "manager_email": "kunal.aggarwal@company.com",
        "basic_salary": Decimal("80000.00"),
        "city": "Delhi",
        "state": "Delhi",
        "address": "C-14 Hauz Khas Enclave",
        "pincode": "110016",
        "contact_name": "Deepak Mahajan",
        "contact_relation": "Father",
        "contact_phone": "+919820090025",
    },

    # ─── Finance & Accounting (DEPT-5) ─────────────────────────────────────────
    {
        "code": "EMP-2026",
        "first_name": "Deepa",
        "last_name": "Namboodiri",
        "email": "deepa.namboodiri@company.com",
        "phone": "+919820010026",
        "dob": datetime.date(1989, 1, 14),
        "joining_date": datetime.date(2020, 3, 1),
        "gender": "female",
        "dept_code": "DEPT-5",
        "designation_title": "Finance Manager",
        "role_name": "Department_Head",
        "manager_email": "meera.nambiar@company.com",
        "basic_salary": Decimal("145000.00"),
        "city": "Pune",
        "state": "Maharashtra",
        "address": "802 Magarpatta City, Hadapsar",
        "pincode": "411028",
        "contact_name": "Unnikrishnan Namboodiri",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090026",
    },
    {
        "code": "EMP-2027",
        "first_name": "Arvind",
        "last_name": "Srivastav",
        "email": "arvind.srivastav@company.com",
        "phone": "+919820010027",
        "dob": datetime.date(1992, 9, 3),
        "joining_date": datetime.date(2021, 7, 15),
        "gender": "male",
        "dept_code": "DEPT-5",
        "designation_title": "Accountant",
        "role_name": "Employee",
        "manager_email": "deepa.namboodiri@company.com",
        "basic_salary": Decimal("75000.00"),
        "city": "Pune",
        "state": "Maharashtra",
        "address": "204 Viman Nagar Central Road",
        "pincode": "411014",
        "contact_name": "R. C. Srivastav",
        "contact_relation": "Father",
        "contact_phone": "+919820090027",
    },

    # ─── Operations & Support (DEPT-6) ─────────────────────────────────────────
    {
        "code": "EMP-2028",
        "first_name": "Sandeep",
        "last_name": "Tiwari",
        "email": "sandeep.tiwari@company.com",
        "phone": "+919820010028",
        "dob": datetime.date(1988, 6, 17),
        "joining_date": datetime.date(2019, 11, 1),
        "gender": "male",
        "dept_code": "DEPT-6",
        "designation_title": "Operations Manager",
        "role_name": "Department_Head",
        "manager_email": "rajesh.sharma@company.com",
        "basic_salary": Decimal("135000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "Flat 302, Ozone Urbana, Devanahalli",
        "pincode": "562110",
        "contact_name": "Pooja Tiwari",
        "contact_relation": "Spouse",
        "contact_phone": "+919820090028",
    },
    {
        "code": "EMP-2029",
        "first_name": "Bhavna",
        "last_name": "Gokhale",
        "email": "bhavna.gokhale@company.com",
        "phone": "+919820010029",
        "dob": datetime.date(1994, 10, 11),
        "joining_date": datetime.date(2022, 8, 1),
        "gender": "female",
        "dept_code": "DEPT-6",
        "designation_title": "Software Engineer",
        "role_name": "Employee",
        "manager_email": "sandeep.tiwari@company.com",
        "basic_salary": Decimal("78000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "52 Banashankari 3rd Stage, 100ft Road",
        "pincode": "560085",
        "contact_name": "Suresh Gokhale",
        "contact_relation": "Father",
        "contact_phone": "+919820090029",
    },
    {
        "code": "EMP-2030",
        "first_name": "Nikhil",
        "last_name": "Pai",
        "email": "nikhil.pai@company.com",
        "phone": "+919820010030",
        "dob": datetime.date(1996, 3, 23),
        "joining_date": datetime.date(2023, 4, 1),
        "gender": "male",
        "dept_code": "DEPT-6",
        "designation_title": "Junior Software Engineer",
        "role_name": "Employee",
        "manager_email": "sandeep.tiwari@company.com",
        "basic_salary": Decimal("55000.00"),
        "city": "Bengaluru",
        "state": "Karnataka",
        "address": "18 Malleshwaram 8th Cross",
        "pincode": "560003",
        "contact_name": "Girish Pai",
        "contact_relation": "Father",
        "contact_phone": "+919820090030",
    },
]


def seed_employees(db):
    """Seeds 30 structured employee profiles with full relational structures."""
    print("--> Seeding 30 Rich Employees and Relational Entities...")

    depts = {d.dept_code: d for d in db.query(Department).all()}
    designations = {ds.title.strip().lower(): ds for ds in db.query(Designation).all()}
    roles = {r.role_name: r for r in db.query(Role).all()}
    leave_types = db.query(LeaveType).all()

    # Default password hash for seeded employees
    pwd_hash = security.hash_password("TestPass123!")

    created_count = 0
    updated_count = 0

    for item in SEED_EMPLOYEES:
        dept = depts.get(item["dept_code"])
        if not dept:
            print(f"   [!] Department '{item['dept_code']}' not found, skipping {item['email']}")
            continue

        desig_key = item["designation_title"].strip().lower()
        desig = designations.get(desig_key)
        if not desig:
            # Fallback to Software Engineer
            desig = designations.get("software engineer") or list(designations.values())[0]

        role = roles.get(item["role_name"]) or roles.get("Employee")

        # 1. User
        user = db.scalar(select(User).where(func.lower(User.email) == item["email"].lower()))
        display_name = f"{item['first_name']} {item['last_name']}"
        if not user:
            user = User(
                email=item["email"].lower(),
                display_name=display_name,
                password_hash=pwd_hash,
                is_active=True,
            )
            db.add(user)
            db.flush()
        else:
            user.display_name = display_name
            user.is_active = True
            db.flush()

        # 2. UserRole
        if role:
            ur = db.scalar(
                select(UserRole).where(UserRole.user_id == user.user_id, UserRole.role_id == role.role_id)
            )
            if not ur:
                db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
                db.flush()

        # 3. Employee
        emp = db.scalar(select(Employee).where(Employee.email == item["email"].lower()))
        is_new = emp is None
        if is_new:
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
                employment_type="intern" if item["designation_title"] == "Intern" else "full_time",
                dept_id=dept.dept_id,
                designation_id=desig.designation_id if desig else None,
                is_active=True,
            )
            db.add(emp)
            db.flush()
            created_count += 1
        else:
            emp.first_name = item["first_name"]
            emp.last_name = item["last_name"]
            emp.phone = item["phone"]
            emp.dept_id = dept.dept_id
            emp.designation_id = desig.designation_id if desig else None
            emp.is_active = True
            db.flush()
            updated_count += 1

        # 4. Address & EmployeeAddress
        existing_emp_addr = db.scalar(
            select(EmployeeAddress).where(
                EmployeeAddress.employee_id == emp.emp_id,
                EmployeeAddress.address_type == "current",
            )
        )
        if not existing_emp_addr:
            addr = Address(
                street_address=item["address"],
                city=item["city"],
                state=item["state"],
                country="India",
                pincode=item["pincode"],
            )
            db.add(addr)
            db.flush()
            emp_addr = EmployeeAddress(
                employee_id=emp.emp_id,
                address_id=addr.address_id,
                address_type="current",
                is_primary=True,
            )
            db.add(emp_addr)
            db.flush()

        # 5. Emergency Contact
        existing_contact = db.scalar(
            select(EmergencyContact).where(
                EmergencyContact.emp_id == emp.emp_id,
                EmergencyContact.is_primary == True,
            )
        )
        if not existing_contact:
            contact = EmergencyContact(
                emp_id=emp.emp_id,
                contact_name=item["contact_name"],
                relationship=item["contact_relation"],
                phone=item["contact_phone"],
                email=f"{item['first_name'].lower()}.kin@example.com",
                is_primary=True,
            )
            db.add(contact)
            db.flush()

        # 6. Salary & Components
        existing_salary = db.scalar(
            select(Salary).where(Salary.emp_id == emp.emp_id)
        )
        if not existing_salary:
            basic = item["basic_salary"]
            hra = Decimal(round(float(basic) * 0.40, 2))
            allowance = Decimal(round(float(basic) * 0.20, 2))
            net = basic + hra + allowance
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
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="HRA", component_type="earning", amount=hra))
            db.add(SalaryComponent(salary_id=sal.salary_id, component_name="Special Allowance", component_type="earning", amount=allowance))
            db.flush()

        # 7. Leave Balances
        for lt in leave_types:
            bal_exists = db.scalar(
                select(EmployeeLeaveBalance).where(
                    EmployeeLeaveBalance.employee_id == emp.emp_id,
                    EmployeeLeaveBalance.leave_type_id == lt.leave_type_id,
                    EmployeeLeaveBalance.year == 2026,
                )
            )
            if not bal_exists:
                db.add(
                    EmployeeLeaveBalance(
                        employee_id=emp.emp_id,
                        leave_type_id=lt.leave_type_id,
                        total_allocated=lt.max_days_per_year or 12,
                        used_leaves=0,
                        year=2026,
                    )
                )

        # 8. Sample Attendance (recent weekdays)
        for days_ago in range(1, 4):
            att_date = datetime.date(2026, 8, 24) - datetime.timedelta(days=days_ago)
            if att_date.weekday() < 5:  # Monday to Friday
                att_exists = db.scalar(
                    select(Attendance).where(
                        Attendance.emp_id == emp.emp_id,
                        Attendance.date == att_date,
                    )
                )
                if not att_exists:
                    tz = datetime.timezone.utc
                    cin = datetime.datetime.combine(att_date, datetime.time(9, 30), tzinfo=tz)
                    cout = datetime.datetime.combine(att_date, datetime.time(18, 30), tzinfo=tz)
                    db.add(
                        Attendance(
                            emp_id=emp.emp_id,
                            date=att_date,
                            status="present",
                            check_in=cin,
                            check_out=cout,
                            total_hours=Decimal("9.00"),
                            work_mode="in_office",
                        )
                    )

    db.commit()

    # 9. Link Reporting Managers
    print("--> Resolving Reporting Managers Hierarchy...")
    for item in SEED_EMPLOYEES:
        mgr_email = item.get("manager_email")
        if mgr_email:
            emp = db.scalar(select(Employee).where(Employee.email == item["email"].lower()))
            mgr = db.scalar(select(Employee).where(func.lower(Employee.email) == mgr_email.lower()))
            if emp and mgr:
                emp.reporting_manager_id = mgr.emp_id
                db.flush()
    db.commit()

    print(f"   [+] Successfully seeded! Created: {created_count}, Updated: {updated_count} employees.")


def run_seed():
    db = SessionLocal()
    try:
        sync_role_permissions(db)
        seed_employees(db)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
