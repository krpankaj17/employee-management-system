package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.BankDetailIn;
import com.datansh.EmployeeManagment.dto.BankDetailOut;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.PayrollService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/bank-details")
@Tag(name = "Bank Details", description = "Employee bank account details for payroll disbursement")
public class BankDetailController {

    @Autowired
    private PayrollService payrollService;

    @PostMapping
    @PreAuthorize("hasAuthority('payroll:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Adds a bank account for payroll disbursement (Admin/HR only)")
    public ResponseEntity<BankDetailOut> addBankDetail(
            @Valid @RequestBody BankDetailIn payload
    ) {
        BankDetailOut result = payrollService.addBankDetail(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('payroll:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Updates an existing bank account record (Admin/HR only)")
    public ResponseEntity<BankDetailOut> updateBankDetail(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody com.datansh.EmployeeManagment.dto.BankDetailUpdateIn payload
    ) {
        BankDetailOut result = payrollService.updateBankDetail(UUID.fromString(publicId), payload);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('payroll:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes a bank account record (Admin/HR only)")
    public ResponseEntity<java.util.Map<String, String>> deleteBankDetail(@PathVariable("public_id") String publicId) {
        payrollService.deleteBankDetail(UUID.fromString(publicId));
        java.util.Map<String, String> res = new java.util.HashMap<>();
        res.put("details", "Bank detail successfully deleted");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    @Operation(summary = "Lists registered bank accounts for the currently authenticated employee")
    public ResponseEntity<List<BankDetailOut>> getMyBankAccounts(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("No employee profile linked to user");
        }
        return ResponseEntity.ok(payrollService.getEmployeeBankDetails(currentUser.getEmployeePublicId()));
    }

    @GetMapping("/{employee_public_id}")
    @Operation(summary = "Lists all bank accounts associated with an employee")
    public ResponseEntity<List<BankDetailOut>> getEmployeeBankDetails(
            @PathVariable("employee_public_id") String employeePublicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("payroll:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager"))
        );
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(employeePublicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view bank details for other employees.");
        }
        return ResponseEntity.ok(payrollService.getEmployeeBankDetails(UUID.fromString(employeePublicId)));
    }
}

