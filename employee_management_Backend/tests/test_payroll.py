import uuid
import datetime
import pytest
from fastapi.testclient import TestClient


def test_payroll_and_salary_flow(client: TestClient, admin_headers, employee_auth):
    emp_pid = employee_auth["employee_public_id"]

    # 1. Validation: Negative net salary after deductions rejected
    invalid_sal = {
        "employee_public_id": emp_pid,
        "basic_salary": 10000.00,
        "effective_from": "2026-01-01",
        "currency": "INR",
        "components": [
            {
                "component_name": "Excessive Deduction",
                "component_type": "deduction",
                "amount": 25000.00,
            }
        ],
    }
    neg_res = client.post("/salaries", json=invalid_sal, headers=admin_headers)
    assert neg_res.status_code == 400

    # 2. Create Valid Salary Structure
    sal_payload = {
        "employee_public_id": emp_pid,
        "basic_salary": 75000.00,
        "effective_from": "2026-01-01",
        "currency": "INR",
        "components": [
            {
                "component_name": "HRA",
                "component_type": "earning",
                "amount": 25000.00,
            },
            {
                "component_name": "Provident Fund",
                "component_type": "deduction",
                "amount": 3600.00,
            },
        ],
    }
    sal_res = client.post("/salaries", json=sal_payload, headers=admin_headers)
    assert sal_res.status_code == 201
    sal_data = sal_res.json()
    assert float(sal_data["basic_salary"]) == 75000.00
    assert float(sal_data["net_salary"]) == 96400.00

    # 3. Get Employee Salary History
    hist_res = client.get(f"/salaries/{emp_pid}", headers=admin_headers)
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert "history" in hist_data
    assert len(hist_data["history"]) >= 1

    # 4. Add Bank Details
    bank_payload = {
        "employee_public_id": emp_pid,
        "bank_name": "HDFC Bank",
        "account_number": f"{uuid.uuid4().int % 100000000000:012d}",
        "routing_code": "HDFC0001234",
        "branch_name": "Indiranagar",
        "account_type": "savings",
        "is_primary": True,
    }
    bank_res = client.post("/bank-details", json=bank_payload, headers=admin_headers)
    assert bank_res.status_code == 201
    bank_data = bank_res.json()
    assert bank_data["account_number"] == bank_payload["account_number"]

    # 5. List Bank Details
    list_banks = client.get(f"/bank-details/{emp_pid}", headers=admin_headers)
    assert list_banks.status_code == 200
    assert len(list_banks.json()) >= 1

    # 6. Process Batch Payroll Run for Month (unique period)
    unique_month = f"2026-07"
    process_payload = {
        "pay_period_start": f"{unique_month}-01",
        "pay_period_end": f"{unique_month}-31",
        "payment_date": f"{unique_month}-31",
        "employee_public_id": emp_pid,
    }
    process_res = client.post("/payroll/process", json=process_payload, headers=admin_headers)
    assert process_res.status_code in (201, 409)

    # 7. List Payroll Runs
    runs_res = client.get(f"/payroll/runs?employee_public_id={emp_pid}", headers=admin_headers)
    assert runs_res.status_code == 200
    runs_data = runs_res.json()
    assert "items" in runs_data

    # 8. Verify Payslip and Disburse
    if runs_data["items"]:
        run_item = runs_data["items"][0]
        run_pid = run_item["public_id"]

        # View Payslip
        payslip_res = client.get(f"/payroll/runs/{run_pid}", headers=admin_headers)
        assert payslip_res.status_code == 200
        payslip_data = payslip_res.json()
        assert "earnings_breakdown" in payslip_data
        assert payslip_data["payroll_public_id"] == run_pid
        assert float(payslip_data["net_paid"]) > 0
        assert float(payslip_data["gross_amount"]) > 0

        # Disburse if pending
        if run_item["payment_status"] == "pending":
            disburse_res = client.post(
                f"/payroll/runs/{run_pid}/disburse",
                json={
                    "payment_method": "bank_transfer",
                    "payment_date": f"{unique_month}-31",
                    "notes": "Salary Disbursed for test run",
                },
                headers=admin_headers,
            )
            assert disburse_res.status_code == 200
            assert disburse_res.json()["payment_status"] == "paid"

