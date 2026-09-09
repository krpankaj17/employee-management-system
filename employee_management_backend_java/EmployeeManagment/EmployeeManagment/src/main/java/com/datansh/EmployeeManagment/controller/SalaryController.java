package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.SalaryCreateIn;
import com.datansh.EmployeeManagment.dto.SalaryHistoryOut;
import com.datansh.EmployeeManagment.dto.SalaryOut;
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

import java.util.UUID;

@RestController
@RequestMapping("/salaries")
@Tag(name = "Compensation & Salaries", description = "Salary revision history and itemized earnings/deductions structure")
public class SalaryController {


    @Autowired
    private PayrollService payrollService;

    @PostMapping
    @PreAuthorize("hasAuthority('salary:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Defines or updates salary structure with earnings and deductions")
    public ResponseEntity<SalaryOut> createSalaryStructure(@Valid @RequestBody SalaryCreateIn payload) {
        SalaryOut result = payrollService.createSalaryStructure(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('salary:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Updates an existing salary structure revision (Admin/HR only)")
    public ResponseEntity<SalaryOut> updateSalaryStructure(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody SalaryCreateIn payload
    ) {
        SalaryOut result = payrollService.updateSalary(UUID.fromString(publicId), payload);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('salary:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes an erroneous salary structure revision (Admin/HR only)")
    public ResponseEntity<java.util.Map<String, String>> deleteSalaryStructure(@PathVariable("public_id") String publicId) {
        payrollService.deleteSalary(UUID.fromString(publicId));
        java.util.Map<String, String> res = new java.util.HashMap<>();
        res.put("details", "Salary structure revision successfully deleted");
        return ResponseEntity.ok(res);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('salary:view') or hasAuthority('salary:read') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Retrieves all active salary structures across all employees (Admin/HR only)")
    public ResponseEntity<java.util.List<SalaryOut>> getAllSalaries() {
        return ResponseEntity.ok(payrollService.getAllActiveSalaries());
    }

    @GetMapping("/me")
    @Operation(summary = "Retrieves active salary structure and complete history for current employee")
    public ResponseEntity<SalaryHistoryOut> getMySalaries(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("No employee profile linked to user");
        }
        return ResponseEntity.ok(payrollService.getEmployeeSalaryHistory(currentUser.getEmployeePublicId()));
    }

    @GetMapping("/{employee_public_id}")
    @Operation(summary = "Retrieves complete compensation revision history for an employee")
    public ResponseEntity<SalaryHistoryOut> getSalaryHistory(
            @PathVariable("employee_public_id") String employeePublicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("salary:view") || currentUser.hasPermission("salary:read");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(employeePublicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view salary records for other employees.");
        }
        return ResponseEntity.ok(payrollService.getEmployeeSalaryHistory(UUID.fromString(employeePublicId)));
    }
}

