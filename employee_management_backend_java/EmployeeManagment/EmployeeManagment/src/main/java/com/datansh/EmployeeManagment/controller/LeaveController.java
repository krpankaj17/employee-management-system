package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.LeaveService;
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
@RequestMapping("/leaves")
@Tag(name = "Leave Management", description = "Leave balance tracking, leave requests, and multi-tier approval workflow")
public class LeaveController {


    @Autowired
    private LeaveService leaveService;

    @GetMapping("/types")
    @Operation(summary = "Lists all configured leave types")
    public ResponseEntity<List<LeaveTypeOut>> listLeaveTypes() {
        return ResponseEntity.ok(leaveService.getAllLeaveTypes());
    }

    @PostMapping("/types")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Creates a new leave type")
    public ResponseEntity<LeaveTypeOut> createLeaveType(@Valid @RequestBody LeaveTypeIn payload) {
        LeaveTypeOut result = leaveService.createLeaveType(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/types/{public_id}")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Updates an existing leave type (Admin only)")
    public ResponseEntity<LeaveTypeOut> updateLeaveType(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody LeaveTypeIn payload
    ) {
        LeaveTypeOut result = leaveService.updateLeaveType(UUID.fromString(publicId), payload);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/types/{public_id}")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Deletes a leave type (Admin only)")
    public ResponseEntity<java.util.Map<String, String>> deleteLeaveType(
            @PathVariable("public_id") String publicId
    ) {
        leaveService.deleteLeaveType(UUID.fromString(publicId));
        java.util.Map<String, String> res = new java.util.HashMap<>();
        res.put("details", "Leave type successfully deleted");
        return ResponseEntity.ok(res);
    }


    @GetMapping("/balances/me")
    @Operation(summary = "Retrieves leave balances for the currently authenticated employee")
    public ResponseEntity<List<LeaveBalanceOut>> getMyLeaveBalances(
            @RequestParam(defaultValue = "2026") int year,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("No employee profile linked to user");
        }
        return ResponseEntity.ok(leaveService.getEmployeeLeaveBalances(currentUser.getEmployeePublicId(), year));
    }

    @GetMapping("/balances/{employee_public_id}")
    @Operation(summary = "Retrieves leave balances for an employee")
    public ResponseEntity<List<LeaveBalanceOut>> getEmployeeLeaveBalances(
            @PathVariable("employee_public_id") String employeePublicId,
            @RequestParam(defaultValue = "2026") int year,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("leave:read") || currentUser.hasPermission("leave:approve");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(employeePublicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view leave balances for other employees.");
        }
        return ResponseEntity.ok(leaveService.getEmployeeLeaveBalances(UUID.fromString(employeePublicId), year));
    }

    @PostMapping("/allocate")
    @PreAuthorize("hasRole('Admin')")
    @Operation(summary = "Allocates annual leave quota for an employee")
    public ResponseEntity<LeaveBalanceOut> allocateLeaveBalance(@Valid @RequestBody LeaveBalanceIn payload) {
        LeaveBalanceOut result = leaveService.allocateLeaveBalance(payload);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/requests")
    @Operation(summary = "Submits a leave request with balance verification")
    public ResponseEntity<LeaveRequestOut> submitLeaveRequest(
            @Valid @RequestBody LeaveRequestIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        Long submittingEmpId = null;
        if (currentUser.getEmployeePublicId() != null) {
            if (payload.getEmployeePublicId() == null || payload.getEmployeePublicId().isBlank()) {
                payload.setEmployeePublicId(currentUser.getEmployeePublicId().toString());
            }
        }
        LeaveRequestOut result = leaveService.submitLeaveRequest(payload, submittingEmpId);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/requests")
    @Operation(summary = "Lists leave requests with filters and pagination")
    public ResponseEntity<PaginatedLeaveRequests> listLeaveRequests(
            @RequestParam(required = false) String employee_public_id,
            @RequestParam(required = false) String status_filter,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("leave:read") || currentUser.hasPermission("leave:approve");
        String effectiveEmpId = employee_public_id;

        if (!hasPerm) {
            if (currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("No employee profile linked to user");
            }
            effectiveEmpId = currentUser.getEmployeePublicId().toString();
        }

        PaginatedLeaveRequests result = leaveService.getLeaveRequests(effectiveEmpId, status_filter, skip, limit);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/requests/{public_id}")
    @Operation(summary = "Retrieves full details of a leave request including approval history trail")
    public ResponseEntity<LeaveRequestOut> getLeaveRequestDetail(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        LeaveRequestOut detail = leaveService.getLeaveRequestDetail(UUID.fromString(publicId));
        boolean hasPerm = currentUser.hasPermission("leave:read") || currentUser.hasPermission("leave:approve");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(detail.getEmployeePublicId()))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view this leave request.");
        }
        return ResponseEntity.ok(detail);
    }

    @RequestMapping(value = "/requests/{public_id}/action", method = {RequestMethod.POST, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('leave:approve') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Approves, rejects, or escalates a leave request (self-approval prohibited)")
    public ResponseEntity<LeaveRequestOut> processLeaveAction(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody LeaveApprovalActionIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if (currentUser.getEmployeePublicId() == null) {
            throw new ForbiddenException("Only registered employee profiles can approve leaves");
        }
        // Resolve current employee emp_id
        LeaveRequestOut result = leaveService.processLeaveApproval(UUID.fromString(publicId), currentUser.getId(), payload);
        return ResponseEntity.ok(result);
    }

    @RequestMapping(value = "/requests/{public_id}/cancel", method = {RequestMethod.POST, RequestMethod.PUT})
    @Operation(summary = "Cancels a leave request and refunds balance if previously approved")
    public ResponseEntity<LeaveRequestOut> cancelLeave(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        LeaveRequestOut result = leaveService.cancelLeaveRequest(UUID.fromString(publicId), currentUser.getId());
        return ResponseEntity.ok(result);
    }
}
