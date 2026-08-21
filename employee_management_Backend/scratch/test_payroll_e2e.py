# scratch/test_payroll_e2e.py
import sys
from datetime import date, timedelta
from decimal import Decimal
sys.path.insert(0, "src")

from database import SessionLocal
from models.employee import Employee
from models.payroll import Salary, SalaryComponent, BankDetail, PayrollRun
from schemas.payroll_schema import (
    SalaryCreateIn,
    SalaryComponentIn,
    BankDetailIn,
    PayrollProcessIn,
    PayrollDisburseIn,
)
from services import payroll_service, employee_services
from repository import employee_repository as emp_repo


def run_e2e_tests():
    print("==================================================")
    print("  RUNNING PHASE 5 E2E PAYROLL INTEGRATION TESTS   ")
    print("==================================================")

    db = SessionLocal()
    try:
        # Step 1: Find an active employee
        _, employees = emp_repo.get_paginated(db=db, limit=1)
        if not employees:
            print("[SETUP] No employees found in DB. Creating a test employee...")
            # Let's search or use get_all
            emp_list = emp_repo.get_all(db=db)
            if not emp_list:
                print("ERROR: Please have at least 1 employee in DB.")
                return False
            emp = emp_list[0]
        else:
            emp = employees[0]

        emp_public_id = str(emp.public_id)
        print(f"[1] Target Test Employee: {emp.first_name} {emp.last_name} ({emp.employee_code}, UUID: {emp_public_id})")

        # Step 2: Test Salary Structure Creation
        print("\n[2] Creating initial Salary Revision...")
        salary_in_1 = SalaryCreateIn(
            employee_public_id=emp_public_id,
            basic_salary=Decimal("50000.00"),
            currency="INR",
            effective_from=date(2026, 1, 1),
            components=[
                SalaryComponentIn(component_name="HRA", component_type="earning", amount=Decimal("20000.00")),
                SalaryComponentIn(component_name="Special Allowance", component_type="earning", amount=Decimal("10000.00")),
                SalaryComponentIn(component_name="Provident Fund (PF)", component_type="deduction", amount=Decimal("3600.00")),
                SalaryComponentIn(component_name="Professional Tax", component_type="deduction", amount=Decimal("200.00")),
            ],
        )
        res1 = payroll_service.create_salary_structure(salary_in_1, db=db)
        assert res1["ok"] is True, f"Failed to create salary: {res1}"
        sal1_data = res1["salary"]
        expected_net_1 = 50000.00 + 20000.00 + 10000.00 - 3600.00 - 200.00  # 76200.00
        assert sal1_data["basic_salary"] == 50000.00, f"Expected 50000, got {sal1_data['basic_salary']}"
        assert sal1_data["net_salary"] == expected_net_1, f"Expected {expected_net_1}, got {sal1_data['net_salary']}"
        print(f"    Salary 1 Created Successfully: Net Pay = {sal1_data['net_salary']} {sal1_data['currency']}")

        # Step 3: Test Second Revision with GiST exclusion safety (auto-closing prior revision)
        print("\n[3] Creating second Salary Revision (Testing GiST non-overlap automatic boundary close)...")
        salary_in_2 = SalaryCreateIn(
            employee_public_id=emp_public_id,
            basic_salary=Decimal("60000.00"),
            currency="INR",
            effective_from=date(2026, 7, 1),
            components=[
                SalaryComponentIn(component_name="HRA", component_type="earning", amount=Decimal("24000.00")),
                SalaryComponentIn(component_name="Special Allowance", component_type="earning", amount=Decimal("12000.00")),
                SalaryComponentIn(component_name="Provident Fund (PF)", component_type="deduction", amount=Decimal("4320.00")),
                SalaryComponentIn(component_name="Professional Tax", component_type="deduction", amount=Decimal("200.00")),
            ],
        )
        res2 = payroll_service.create_salary_structure(salary_in_2, db=db)
        assert res2["ok"] is True, f"Failed to create salary revision 2: {res2}"
        sal2_data = res2["salary"]
        expected_net_2 = 60000.00 + 24000.00 + 12000.00 - 4320.00 - 200.00  # 91480.00
        assert sal2_data["net_salary"] == expected_net_2
        print(f"    Salary 2 Created Successfully: Net Pay = {sal2_data['net_salary']} {sal2_data['currency']}")

        # Verify salary history
        history_res = payroll_service.get_employee_salary_history(emp_public_id, db=db)
        assert history_res["ok"] is True
        print(f"    Salary History Fetched: {len(history_res['data']['history'])} revisions found.")

        # Step 4: Test Bank Details & Primary Flag Switching
        print("\n[4] Testing Bank Details and Primary Account switching...")
        bank_in_1 = BankDetailIn(
            employee_public_id=emp_public_id,
            bank_name="HDFC Bank",
            branch_name="Connaught Place",
            account_number="50100234567890",
            routing_code="HDFC0000123",
            account_type="savings",
            is_primary=True,
        )
        b_res1 = payroll_service.add_bank_detail(bank_in_1, db=db)
        assert b_res1["ok"] is True, f"Failed bank 1: {b_res1}"

        # Add second bank account as primary
        bank_in_2 = BankDetailIn(
            employee_public_id=emp_public_id,
            bank_name="ICICI Bank",
            branch_name="Cyber City",
            account_number="002105123456",
            routing_code="ICIC0000567",
            account_type="salary" if "salary" in [] else "savings",
            is_primary=True,
        )
        b_res2 = payroll_service.add_bank_detail(bank_in_2, db=db)
        assert b_res2["ok"] is True, f"Failed bank 2: {b_res2}"

        # Verify bank accounts list
        bank_list = payroll_service.get_employee_bank_details(emp_public_id, db=db)
        assert bank_list["ok"] is True
        primary_accounts = [b for b in bank_list["items"] if b["is_primary"] is True]
        assert len(primary_accounts) == 1, f"Expected exactly 1 primary bank account, found {len(primary_accounts)}"
        assert primary_accounts[0]["bank_name"] == "ICICI Bank"
        print(f"    Bank Accounts Managed: Primary account is correctly {primary_accounts[0]['bank_name']}")

        # Step 5: Test Payroll Batch Processing
        print("\n[5] Processing Payroll Calculation for period 2026-08-01 to 2026-08-31...")
        payroll_in = PayrollProcessIn(
            pay_period_start=date(2026, 8, 1),
            pay_period_end=date(2026, 8, 31),
            employee_public_id=emp_public_id,
        )
        pay_res = payroll_service.process_payroll_batch(payroll_in, db=db)
        assert pay_res["ok"] is True, f"Payroll process failed: {pay_res}"
        summary = pay_res["summary"]
        assert summary["total_processed"] >= 1
        payroll_run_data = summary["runs"][0]
        payroll_public_id = payroll_run_data["public_id"]
        print(f"    Payroll Run Created: Gross = {payroll_run_data['gross_amount']}, Deductions = {payroll_run_data['total_deductions']}, Net Paid = {payroll_run_data['net_paid']}")

        # Step 6: Test Payslip Generation & Detail View
        print("\n[6] Retrieving Itemized Payslip...")
        payslip_res = payroll_service.get_payslip_detail(payroll_public_id, db=db)
        assert payslip_res["ok"] is True, f"Payslip fetch failed: {payslip_res}"
        payslip = payslip_res["payslip"]
        assert payslip["bank_account_masked"].startswith("******")
        assert len(payslip["earnings_breakdown"]) > 0
        assert len(payslip["deductions_breakdown"]) > 0
        print(f"    Payslip Generated for {payslip['employee_name']}:")
        print(f"      - Bank: {payslip['bank_name']} ({payslip['bank_account_masked']})")
        print(f"      - Gross Pay: {payslip['gross_amount']}")
        print(f"      - Net Pay: {payslip['net_paid']}")
        print(f"      - Status: {payslip['payment_status']}")

        # Step 7: Test Payroll Disbursement
        print("\n[7] Testing Disbursement...")
        disburse_in = PayrollDisburseIn(
            payment_method="bank_transfer",
            transaction_ref="NEFT-20260831-987654321",
            payment_date=date(2026, 8, 31),
        )
        disburse_res = payroll_service.disburse_payroll_run(payroll_public_id, payload=disburse_in, db=db)
        assert disburse_res["ok"] is True, f"Disburse failed: {disburse_res}"
        assert disburse_res["payroll_run"]["payment_status"] == "paid"
        assert disburse_res["payroll_run"]["transaction_ref"] == "NEFT-20260831-987654321"
        print(f"    Disbursed Successfully! Payment Status: {disburse_res['payroll_run']['payment_status']}, Ref: {disburse_res['payroll_run']['transaction_ref']}")

        # Step 8: Test Paginated Runs
        print("\n[8] Testing Paginated Runs List...")
        runs_list = payroll_service.get_payroll_runs_paginated(skip=0, limit=10, db=db)
        assert runs_list["ok"] is True
        assert runs_list["total"] >= 1
        print(f"    Paginated Runs List OK (Total: {runs_list['total']})")

        print("\n==================================================")
        print("  ALL PHASE 5 PAYROLL E2E TESTS PASSED WITH 100%!  ")
        print("==================================================")
        return True

    finally:
        db.close()


if __name__ == "__main__":
    success = run_e2e_tests()
    if not success:
        sys.exit(1)
