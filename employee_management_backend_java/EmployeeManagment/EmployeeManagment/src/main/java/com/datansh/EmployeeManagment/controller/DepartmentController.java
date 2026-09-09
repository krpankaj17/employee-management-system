package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.DepartmentIn;
import com.datansh.EmployeeManagment.dto.DepartmentOut;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.DepartmentService;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/departments")
@Tag(name = "Department Management", description = "Department hierarchy, codes, and department heads")
public class DepartmentController {

    @Autowired
    private DepartmentService departmentService;

    @GetMapping
    @PreAuthorize("hasAuthority('department:read') or hasAuthority('department:view') or hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Get All Departments")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.PaginatedDepartments> listDepartments(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(departmentService.listDepartments(skip, limit));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current employee's department")
    public ResponseEntity<DepartmentOut> getMyDepartment(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @org.springframework.security.core.annotation.AuthenticationPrincipal com.datansh.EmployeeManagment.security.UserDetailsImpl currentUser
    ) {
        return ResponseEntity.ok(departmentService.getMyDepartment(currentUser.getPublicId()));
    }

    @GetMapping("/me/employees")
    @Operation(summary = "Get employees in current employee's department")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.DepartmentEmployees> getMyDepartmentEmployees(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @org.springframework.security.core.annotation.AuthenticationPrincipal com.datansh.EmployeeManagment.security.UserDetailsImpl currentUser
    ) {
        return ResponseEntity.ok(departmentService.getMyDepartmentEmployees(currentUser.getPublicId(), skip, limit));
    }

    @GetMapping("/{public_id}")
    @Operation(summary = "Get Department By Public Id")
    public ResponseEntity<DepartmentOut> getDepartmentById(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("department:read") || currentUser.hasPermission("department:view");
        if (!hasPerm) {
            // Employees can only view their own department
            DepartmentOut myDept = departmentService.getMyDepartment(currentUser.getPublicId());
            if (myDept == null || !myDept.getPublicId().equalsIgnoreCase(publicId)) {
                throw new ForbiddenException("Access not granted: You do not have permission to view other departments.");
            }
        }
        return ResponseEntity.ok(departmentService.getDepartmentByPublicId(UUID.fromString(publicId)));
    }

    @GetMapping("/{public_id}/employees")
    @Operation(summary = "Get Department Employees")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.DepartmentEmployees> getDepartmentEmployees(
            @PathVariable("public_id") String publicId,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("department:read") || currentUser.hasPermission("department:view");
        if (!hasPerm) {
            // Employees can only view employees within their own department
            DepartmentOut myDept = departmentService.getMyDepartment(currentUser.getPublicId());
            if (myDept == null || !myDept.getPublicId().equalsIgnoreCase(publicId)) {
                throw new ForbiddenException("Access not granted: You do not have permission to view employees in other departments.");
            }
        }
        return ResponseEntity.ok(departmentService.getDepartmentEmployees(UUID.fromString(publicId), skip, limit));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('department:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Create Department")
    public ResponseEntity<DepartmentOut> createDepartment(@Valid @RequestBody DepartmentIn payload) {
        DepartmentOut result = departmentService.createDepartment(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('department:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Update Department")
    public ResponseEntity<DepartmentOut> updateDepartment(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody DepartmentIn payload
    ) {
        return ResponseEntity.ok(departmentService.updateDepartment(UUID.fromString(publicId), payload));
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('department:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Delete Department")
    public ResponseEntity<Map<String, String>> deleteDepartment(@PathVariable("public_id") String publicId) {
        departmentService.deleteDepartment(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Department successfully deleted");
        return ResponseEntity.ok(res);
    }
}
