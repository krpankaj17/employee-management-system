package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.User;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.repository.UserRepository;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.AddressService;
import com.datansh.EmployeeManagment.service.EmployeeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/employees")
@Tag(name = "Employee Management", description = "Employee directory search, profile lifecycle, addresses and emergency contacts")
public class EmployeeController {

    @Autowired
    private EmployeeService employeeService;

    @Autowired
    private AddressService addressService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/search")
    @Operation(summary = "Lists and searches employee directory with multi-field filtering and pagination")
    public ResponseEntity<PaginatedEmployees> searchEmployees(

            @RequestParam(required = false) String public_id,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String employee_code,
            @RequestParam(required = false) String reporting_manager_public_id,
            @RequestParam(required = false) String first_name,
            @RequestParam(required = false) String last_name,
            @RequestParam(required = false) String department_public_id,
            @RequestParam(required = false) String designation_public_id,
            @RequestParam(required = false) String employee_status,
            @RequestParam(required = false) String employment_type,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate min_joining_date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate max_joining_date,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("employee:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager"))
        );

        if (!hasPerm) {
            if (currentUser == null || currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
            }
            public_id = currentUser.getEmployeePublicId().toString();
        }

        PaginatedEmployees result = employeeService.searchEmployees(
                public_id, email, employee_code, reporting_manager_public_id,
                first_name, last_name, department_public_id, designation_public_id,
                employee_status, employment_type, gender, min_joining_date, max_joining_date,
                skip, limit
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me")
    @Operation(summary = "Retrieves the complete full profile of the currently authenticated employee")
    public ResponseEntity<EmployeeFullProfileOut> getMyEmployeeProfile(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        User user = userRepository.findByPublicId(currentUser.getPublicId())
                .orElseThrow(() -> new ForbiddenException("User not found"));
        return ResponseEntity.ok(employeeService.getMyFullProfile(user));
    }

    @PutMapping("/me")
    @Operation(summary = "Updates the authenticated employee's basic personal details, addresses, and emergency contacts")
    public ResponseEntity<EmployeeFullProfileOut> updateMyEmployeeProfile(
            @Valid @RequestBody EmployeeProfileIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        User user = userRepository.findByPublicId(currentUser.getPublicId())
                .orElseThrow(() -> new ForbiddenException("User not found"));
        return ResponseEntity.ok(employeeService.updateMyProfile(user, payload));
    }

    @PutMapping("/{public_id}/admin-setup")
    @PreAuthorize("hasAuthority('employee:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Configures corporate information, bank details, salary, and optional personal data in one composite request")
    public ResponseEntity<EmployeeFullProfileOut> setupEmployeeAdminData(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody AdminEmployeeSetupIn payload
    ) {
        return ResponseEntity.ok(employeeService.adminSetupEmployee(UUID.fromString(publicId), payload));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('employee:create') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Directly creates/onboards a new employee in the enterprise database")
    public ResponseEntity<EmployeeOut> createEmployee(@Valid @RequestBody EmployeeIn payload) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.createEmployee(payload));
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('employee:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Updates an existing employee record")
    public ResponseEntity<EmployeeOut> updateEmployeeData(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody EmployeeIn payload
    ) {
        return ResponseEntity.ok(employeeService.updateEmployee(UUID.fromString(publicId), payload));
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('employee:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Offboards / deletes an employee")
    public ResponseEntity<Map<String, String>> deleteEmployee(@PathVariable("public_id") String publicId) {
        employeeService.deleteEmployee(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Employee successfully offboarded");
        return ResponseEntity.ok(res);
    }

    // ─── Address Sub-Routes ─────────────────────────────────────────────────────

    @GetMapping("/{public_id}/addresses")
    @Operation(summary = "Lists all addresses for an employee")
    public ResponseEntity<List<AddressOut>> getEmployeeAddresses(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:view") || currentUser.hasPermission("employee:read");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view addresses for other employees.");
        }
        return ResponseEntity.ok(addressService.getAddresses(UUID.fromString(publicId)));
    }

    @PostMapping("/{public_id}/addresses")
    @Operation(summary = "Adds an address for an employee")
    public ResponseEntity<AddressOut> addEmployeeAddress(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody AddressIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:update");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to update addresses for other employees.");
        }
        AddressOut result = addressService.addAddress(UUID.fromString(publicId), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/{public_id}/addresses/{address_public_id}")
    @Operation(summary = "Deletes an address from an employee")
    public ResponseEntity<Map<String, String>> deleteEmployeeAddress(
            @PathVariable("public_id") String publicId,
            @PathVariable("address_public_id") String addressPublicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:update");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to delete addresses for other employees.");
        }
        addressService.deleteAddress(UUID.fromString(publicId), UUID.fromString(addressPublicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Address successfully deleted");
        return ResponseEntity.ok(res);
    }

    // ─── Emergency Contact Sub-Routes ──────────────────────────────────────────

    @GetMapping("/{public_id}/emergency-contacts")
    @Operation(summary = "Lists all emergency contacts for an employee")
    public ResponseEntity<List<EmergencyContactOut>> getEmployeeEmergencyContacts(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:view") || currentUser.hasPermission("employee:read");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to view emergency contacts for other employees.");
        }
        return ResponseEntity.ok(addressService.getEmergencyContacts(UUID.fromString(publicId)));
    }

    @PostMapping("/{public_id}/emergency-contacts")
    @Operation(summary = "Adds an emergency contact for an employee")
    public ResponseEntity<EmergencyContactOut> addEmployeeEmergencyContact(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody EmergencyContactIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:update");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to update emergency contacts for other employees.");
        }
        EmergencyContactOut result = addressService.addEmergencyContact(UUID.fromString(publicId), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/{public_id}/emergency-contacts/{contact_id}")
    @Operation(summary = "Deletes an emergency contact")
    public ResponseEntity<Map<String, String>> deleteEmployeeEmergencyContact(
            @PathVariable("public_id") String publicId,
            @PathVariable("contact_id") Long contactId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:update");
        if (!hasPerm && (currentUser.getEmployeePublicId() == null || !currentUser.getEmployeePublicId().toString().equalsIgnoreCase(publicId))) {
            throw new ForbiddenException("Access not granted: You do not have permission to delete emergency contacts for other employees.");
        }
        addressService.deleteEmergencyContact(UUID.fromString(publicId), contactId);
        Map<String, String> res = new HashMap<>();
        res.put("details", "Emergency contact successfully deleted");
        return ResponseEntity.ok(res);
    }
}
