package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.DesignationIn;
import com.datansh.EmployeeManagment.dto.DesignationOut;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.DesignationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/designations")
@Tag(name = "Designation Management", description = "Job titles and grade levels")
public class DesignationController {

    @Autowired
    private DesignationService designationService;

    @Autowired
    private EmployeeRepository employeeRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('employee:read') or hasAuthority('employee:view') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Get All Designations")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.PaginatedDesignations> listDesignations(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(designationService.listDesignations(skip, limit));
    }

    @GetMapping("/{public_id}")
    @Operation(summary = "Get Designation By Public Id")
    public ResponseEntity<DesignationOut> getDesignationById(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("employee:read") || currentUser.hasPermission("employee:view");
        if (!hasPerm) {
            // Employees can only view their own designation
            if (currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
            }
            Employee callerEmployee = employeeRepository.findByPublicId(currentUser.getEmployeePublicId()).orElse(null);
            boolean isOwnDesignation = callerEmployee != null
                    && callerEmployee.getDesignation() != null
                    && callerEmployee.getDesignation().getPublicId().toString().equalsIgnoreCase(publicId);
            if (!isOwnDesignation) {
                throw new ForbiddenException("Access not granted: You do not have permission to view designations for other employees.");
            }
        }
        return ResponseEntity.ok(designationService.getDesignationByPublicId(UUID.fromString(publicId)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('designation:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Create Designation")
    public ResponseEntity<DesignationOut> createDesignation(@Valid @RequestBody DesignationIn payload) {
        DesignationOut result = designationService.createDesignation(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('designation:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Update Designation")
    public ResponseEntity<DesignationOut> updateDesignation(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody DesignationIn payload
    ) {
        return ResponseEntity.ok(designationService.updateDesignation(UUID.fromString(publicId), payload));
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('designation:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Delete Designation")
    public ResponseEntity<Map<String, String>> deleteDesignation(@PathVariable("public_id") String publicId) {
        designationService.deleteDesignation(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Designation successfully deleted");
        return ResponseEntity.ok(res);
    }

}
