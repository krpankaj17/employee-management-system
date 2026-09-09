package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.PayrollService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/payroll")
@Tag(name = "Payroll Management", description = "Monthly payroll run batch generation, payslip generation, and disbursement confirmation")
public class PayrollController {


    @Autowired
    private PayrollService payrollService;

    @PostMapping("/process")
    @PreAuthorize("hasAuthority('payroll:run') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Executes payroll calculations and generates pending pay runs for target employees")
    public ResponseEntity<PayrollProcessSummary> processPayroll(@Valid @RequestBody PayrollProcessIn payload) {
        PayrollProcessSummary result = payrollService.processPayrollBatch(payload);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/runs")
    @PreAuthorize("hasAuthority('payroll:view') or hasAuthority('payroll:read') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Lists and filters historical payroll runs")
    public ResponseEntity<PaginatedPayrollRuns> listPayrollRuns(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String employee_public_id,
            @RequestParam(required = false) String payment_status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate pay_period_start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate pay_period_end
    ) {
        PaginatedPayrollRuns result = payrollService.getPayrollRunsPaginated(
                skip, limit, employee_public_id, payment_status, pay_period_start, pay_period_end
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/runs/{payroll_public_id}")
    @Operation(summary = "Generates complete itemized payslip breakdown for a payroll run")
    public ResponseEntity<PayslipOut> getPayslip(
            @PathVariable("payroll_public_id") String payrollPublicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        PayslipOut payslip = payrollService.getPayslipDetail(UUID.fromString(payrollPublicId));
        boolean hasPerm = currentUser.hasPermission("payroll:view") || currentUser.hasPermission("payroll:read");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(payslip.getEmployeePublicId()))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view payslips for other employees.");
        }
        return ResponseEntity.ok(payslip);
    }

    @PostMapping("/runs/{payroll_public_id}/disburse")
    @PreAuthorize("hasAuthority('payroll:disburse') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Confirms salary disbursement, setting payment status to 'paid'")
    public ResponseEntity<PayrollRunOut> disbursePayroll(
            @PathVariable("payroll_public_id") String payrollPublicId,
            @Valid @RequestBody PayrollDisburseIn payload
    ) {
        PayrollRunOut result = payrollService.disbursePayrollRun(UUID.fromString(payrollPublicId), payload);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/runs/{payroll_public_id}")
    @PreAuthorize("hasAuthority('payroll:run') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Cancels / deletes a pending, undisbursed payroll run (Admin/HR only)")
    public ResponseEntity<java.util.Map<String, String>> deletePayrollRun(
            @PathVariable("payroll_public_id") String payrollPublicId
    ) {
        payrollService.deletePayrollRun(UUID.fromString(payrollPublicId));
        java.util.Map<String, String> res = new java.util.HashMap<>();
        res.put("details", "Payroll run successfully deleted");
        return ResponseEntity.ok(res);
    }
}


