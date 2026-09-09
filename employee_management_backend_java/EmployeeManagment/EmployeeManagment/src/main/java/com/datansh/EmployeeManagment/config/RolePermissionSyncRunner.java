package com.datansh.EmployeeManagment.config;

import com.datansh.EmployeeManagment.entity.Permission;
import com.datansh.EmployeeManagment.entity.Role;
import com.datansh.EmployeeManagment.entity.RolePermission;
import com.datansh.EmployeeManagment.entity.RolePermissionId;
import com.datansh.EmployeeManagment.repository.PermissionRepository;
import com.datansh.EmployeeManagment.repository.RolePermissionRepository;
import com.datansh.EmployeeManagment.repository.RoleRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Component
@Slf4j
public class RolePermissionSyncRunner implements ApplicationRunner {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        log.info("[RBAC SYNC] Synchronizing Role Permissions with business rules...");

        Optional<Role> empRoleOpt = roleRepository.findByRoleName("Employee");
        Optional<Role> hrRoleOpt = roleRepository.findByRoleName("HR_Manager");
        Optional<Role> adminRoleOpt = roleRepository.findByRoleName("Admin");
        Optional<Role> deptHeadRoleOpt = roleRepository.findByRoleName("Department_Head");

        // 1. Department Read
        stripPermission(empRoleOpt, "department:read");
        stripPermission(empRoleOpt, "department:view");
        grantPermission(hrRoleOpt, "department:read");
        grantPermission(adminRoleOpt, "department:read");

        // 2. Attendance Administrative Permissions
        List<String> attendanceAdminPerms = List.of(
                "attendance:create",
                "attendance:update",
                "attendance:delete",
                "attendance:read",
                "attendance:view"
        );
        for (String perm : attendanceAdminPerms) {
            stripPermission(empRoleOpt, perm);
            grantPermission(hrRoleOpt, perm);
            grantPermission(adminRoleOpt, perm);
        }

        // 3. Document Administrative Permissions
        List<String> documentAdminPerms = List.of(
                "document:read",
                "document:view",
                "document:delete"
        );
        for (String perm : documentAdminPerms) {
            stripPermission(empRoleOpt, perm);
            grantPermission(hrRoleOpt, perm);
            grantPermission(adminRoleOpt, perm);
        }
        grantPermission(empRoleOpt, "document:upload");

        // 4. Salary Administrative Permissions
        List<String> salaryAdminPerms = List.of(
                "salary:read",
                "salary:view",
                "salary:create",
                "salary:update",
                "salary:delete",
                "payroll:run",
                "payroll:read",
                "payroll:view",
                "payroll:disburse"
        );
        for (String perm : salaryAdminPerms) {
            stripPermission(empRoleOpt, perm);
            grantPermission(hrRoleOpt, perm);
            grantPermission(adminRoleOpt, perm);
        }

        // 5. Leave Administrative Permissions
        stripPermission(empRoleOpt, "leave:approve");
        stripPermission(empRoleOpt, "leave:read");
        stripPermission(empRoleOpt, "leave:view");
        grantPermission(hrRoleOpt, "leave:approve");
        grantPermission(hrRoleOpt, "leave:read");
        grantPermission(adminRoleOpt, "leave:approve");
        grantPermission(adminRoleOpt, "leave:read");
        grantPermission(deptHeadRoleOpt, "leave:approve");
        grantPermission(deptHeadRoleOpt, "leave:read");
        grantPermission(empRoleOpt, "leave:create");
        grantPermission(empRoleOpt, "leave:request");

        // 6. Project Administrative Permissions
        stripPermission(empRoleOpt, "project:view");
        stripPermission(empRoleOpt, "project:read");
        grantPermission(hrRoleOpt, "project:read");
        grantPermission(adminRoleOpt, "project:read");

        // 7. Review Administrative Permissions
        stripPermission(empRoleOpt, "review:view");
        stripPermission(empRoleOpt, "review:read");
        grantPermission(hrRoleOpt, "review:read");
        grantPermission(adminRoleOpt, "review:read");

        // 8. Employee Directory Administrative Permissions
        stripPermission(empRoleOpt, "employee:read");
        stripPermission(empRoleOpt, "employee:view");
        grantPermission(hrRoleOpt, "employee:read");
        grantPermission(adminRoleOpt, "employee:read");

        // 9. Announcement / Notification
        grantPermission(empRoleOpt, "announcement:read");
        grantPermission(empRoleOpt, "announcement:view");
        grantPermission(empRoleOpt, "notification:read");

        log.info("[RBAC SYNC] Role permissions successfully aligned with Python source of truth.");
    }

    private void stripPermission(Optional<Role> roleOpt, String permissionName) {
        if (roleOpt.isEmpty()) return;
        Role role = roleOpt.get();
        Optional<Permission> permOpt = permissionRepository.findByPermissionName(permissionName);
        if (permOpt.isPresent()) {
            Permission perm = permOpt.get();
            if (rolePermissionRepository.existsByRoleRoleIdAndPermissionPermissionId(role.getRoleId(), perm.getPermissionId())) {
                rolePermissionRepository.deleteByRoleIdAndPermissionId(role.getRoleId(), perm.getPermissionId());
                log.info("[RBAC SYNC] Stripped '{}' from role '{}'", permissionName, role.getRoleName());
            }
        }
    }

    private void grantPermission(Optional<Role> roleOpt, String permissionName) {
        if (roleOpt.isEmpty()) return;
        Role role = roleOpt.get();
        Optional<Permission> permOpt = permissionRepository.findByPermissionName(permissionName);
        if (permOpt.isPresent()) {
            Permission perm = permOpt.get();
            if (!rolePermissionRepository.existsByRoleRoleIdAndPermissionPermissionId(role.getRoleId(), perm.getPermissionId())) {
                RolePermission rp = RolePermission.builder()
                        .id(new RolePermissionId(role.getRoleId(), perm.getPermissionId()))
                        .role(role)
                        .permission(perm)
                        .build();
                rolePermissionRepository.save(rp);
                log.info("[RBAC SYNC] Granted '{}' to role '{}'", permissionName, role.getRoleName());
            }
        }
    }
}
