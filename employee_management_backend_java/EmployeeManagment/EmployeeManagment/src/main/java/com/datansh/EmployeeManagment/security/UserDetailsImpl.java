package com.datansh.EmployeeManagment.security;

import com.datansh.EmployeeManagment.entity.Permission;
import com.datansh.EmployeeManagment.entity.Role;
import com.datansh.EmployeeManagment.entity.RolePermission;
import com.datansh.EmployeeManagment.entity.User;
import com.datansh.EmployeeManagment.entity.UserRole;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.*;

@Getter
@AllArgsConstructor
@Builder
public class UserDetailsImpl implements UserDetails {

    private Long id;
    private UUID publicId;
    private String email;
    private String displayName;
    private UUID employeePublicId;
    private Boolean isActive;

    @JsonIgnore
    private String password;

    private Collection<? extends GrantedAuthority> authorities;
    private Set<String> roles;
    private Set<String> permissions;
    private List<String> customPermissions;
    private List<String> revokedPermissions;

    public static UserDetailsImpl build(User user) {
        Set<GrantedAuthority> authorities = new HashSet<>();
        Set<String> roles = new HashSet<>();
        Set<String> permissions = new HashSet<>();

        if (user.getUserRoles() != null) {
            for (UserRole userRole : user.getUserRoles()) {
                Role role = userRole.getRole();
                if (role != null) {
                    roles.add(role.getRoleName());
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getRoleName()));

                    if (role.getRolePermissions() != null) {
                        for (RolePermission rp : role.getRolePermissions()) {
                            Permission p = rp.getPermission();
                            if (p != null) {
                                permissions.add(p.getPermissionName());
                                authorities.add(new SimpleGrantedAuthority(p.getPermissionName()));
                            }
                        }
                    }
                }
            }
        }

        // Apply per-user custom permission grants
        List<String> custom = user.getCustomPermissionsList();
        if (custom != null) {
            for (String cp : custom) {
                permissions.add(cp);
                authorities.add(new SimpleGrantedAuthority(cp));
            }
        }

        // Apply per-user permission revocations
        List<String> revoked = user.getRevokedPermissionsList();
        if (revoked != null) {
            for (String rp : revoked) {
                permissions.remove(rp);
                authorities.removeIf(a -> a.getAuthority().equalsIgnoreCase(rp));
            }
        }

        UUID empPublicId = null;
        if (user.getEmployee() != null) {
            empPublicId = user.getEmployee().getPublicId();
        }

        return UserDetailsImpl.builder()
                .id(user.getUserId())
                .publicId(user.getPublicId())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .employeePublicId(empPublicId)
                .isActive(user.getIsActive())
                .password(user.getPasswordHash())
                .authorities(authorities)
                .roles(roles)
                .permissions(permissions)
                .customPermissions(custom != null ? custom : new ArrayList<>())
                .revokedPermissions(revoked != null ? revoked : new ArrayList<>())
                .build();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return isActive != null ? isActive : true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return isActive != null ? isActive : true;
    }

    public boolean hasRole(String roleName) {
        return roles != null && (roles.contains("Admin") || roles.contains(roleName));
    }

    public boolean hasPermission(String permissionName) {
        if (roles != null && roles.contains("Admin")) return true;
        if (permissions != null) {
            if (permissions.contains("role:manage") || permissions.contains(permissionName)) {
                return true;
            }
            if (permissionName.contains(":view") && permissions.contains(permissionName.replace(":view", ":read"))) {
                return true;
            }
            if (permissionName.contains(":read") && permissions.contains(permissionName.replace(":read", ":view"))) {
                return true;
            }
        }
        return false;
    }
}
