package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.ProjectIn;
import com.datansh.EmployeeManagment.dto.ProjectMemberIn;
import com.datansh.EmployeeManagment.dto.ProjectMemberOut;
import com.datansh.EmployeeManagment.dto.ProjectOut;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.ProjectService;
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
@RequestMapping("/projects")
@Tag(name = "Project Management", description = "Company projects and team assignments")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @GetMapping
    @Operation(summary = "List Projects")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.PaginatedProjects> listProjects(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String head_employee_public_id,
            @RequestParam(required = false) String member_employee_public_id,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("project:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager") || a.getAuthority().equals("ROLE_Project_Manager"))
        );
        String effectiveHeadId = head_employee_public_id;
        String effectiveMemberId = member_employee_public_id;

        if (!hasPerm) {
            if (currentUser == null || currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
            }
            effectiveMemberId = currentUser.getEmployeePublicId().toString();
        }

        com.datansh.EmployeeManagment.dto.PaginatedProjects result = projectService.listProjects(status, effectiveHeadId, effectiveMemberId, skip, limit);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{public_id}")
    @Operation(summary = "Get Project")
    public ResponseEntity<ProjectOut> getProject(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        ProjectOut project = projectService.getProjectByPublicId(UUID.fromString(publicId));
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("project:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager") || a.getAuthority().equals("ROLE_Project_Manager"))
        );
        if (!hasPerm) {
            boolean isMemberOrHead = (project.getMembers() != null
                    && project.getMembers().stream()
                        .anyMatch(m -> currentUser != null && currentUser.getEmployeePublicId() != null
                                && currentUser.getEmployeePublicId().toString().equalsIgnoreCase(m.getEmployeePublicId())))
                    || (project.getProjectHeadPublicId() != null && currentUser != null && currentUser.getEmployeePublicId() != null
                        && project.getProjectHeadPublicId().equalsIgnoreCase(currentUser.getEmployeePublicId().toString()));
            if (!isMemberOrHead) {
                throw new ForbiddenException("Access not granted: You do not have permission to view this project.");
            }
        }
        return ResponseEntity.ok(project);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('project:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Create Project")
    public ResponseEntity<ProjectOut> createProject(@Valid @RequestBody ProjectIn payload) {
        ProjectOut result = projectService.createProject(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @PreAuthorize("hasAuthority('project:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Update Project")
    public ResponseEntity<ProjectOut> updateProject(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody ProjectIn payload
    ) {
        return ResponseEntity.ok(projectService.updateProject(UUID.fromString(publicId), payload));
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('project:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Delete Project")
    public ResponseEntity<Map<String, String>> deleteProject(@PathVariable("public_id") String publicId) {
        projectService.deleteProject(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Project successfully deleted");
        return ResponseEntity.ok(res);
    }

    @PostMapping("/{public_id}/members")
    @PreAuthorize("hasAuthority('project:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Add Project Member")
    public ResponseEntity<ProjectMemberOut> addProjectMember(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody ProjectMemberIn payload
    ) {
        ProjectMemberOut result = projectService.addMember(UUID.fromString(publicId), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/{public_id}/members/{employee_public_id}")
    @PreAuthorize("hasAuthority('project:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Remove Project Member")
    public ResponseEntity<Map<String, String>> removeProjectMember(
            @PathVariable("public_id") String publicId,
            @PathVariable("employee_public_id") String employeePublicId
    ) {
        projectService.removeMember(UUID.fromString(publicId), UUID.fromString(employeePublicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Project member removed");
        return ResponseEntity.ok(res);
    }

}
