package com.datansh.EmployeeManagment.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.*;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_public_id", columnList = "public_id"),
    @Index(name = "idx_users_email", columnList = "email"),
    @Index(name = "idx_users_is_active", columnList = "is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "secondary_email", length = 255)
    private String secondaryEmail;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, columnDefinition = "TEXT")
    private String passwordHash;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "token_version", nullable = false)
    @Builder.Default
    private Integer tokenVersion = 1;

    @Column(name = "last_login")
    private OffsetDateTime lastLogin;


    @Column(name = "password_reset_token", length = 255)
    private String passwordResetToken;

    @Column(name = "password_reset_expires_at")
    private OffsetDateTime passwordResetExpiresAt;

    @Column(name = "password_reset_used_at")
    private OffsetDateTime passwordResetUsedAt;

    @Column(name = "custom_permissions", columnDefinition = "TEXT")
    @Builder.Default
    private String customPermissions = "[]";

    @Column(name = "revoked_permissions", columnDefinition = "TEXT")
    @Builder.Default
    private String revokedPermissions = "[]";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Employee employee;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private Set<UserRole> userRoles = new HashSet<>();

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID();
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
        if (this.isActive == null) {
            this.isActive = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public boolean hasRole(String roleName) {
        if (userRoles == null) return false;
        return userRoles.stream()
                .map(ur -> ur.getRole().getRoleName())
                .anyMatch(r -> "Admin".equalsIgnoreCase(r) || roleName.equalsIgnoreCase(r));
    }

    public List<String> getCustomPermissionsList() {
        if (customPermissions == null || customPermissions.isBlank() || customPermissions.equals("[]")) {
            return new ArrayList<>();
        }
        try {
            return com.datansh.EmployeeManagment.util.JsonUtil.fromJsonList(customPermissions, String.class);
        } catch (Exception e) {
            String clean = customPermissions.replaceAll("[\\[\\]\"\\s]", "");
            return clean.isEmpty() ? new ArrayList<>() : Arrays.asList(clean.split(","));
        }
    }

    public List<String> getRevokedPermissionsList() {
        if (revokedPermissions == null || revokedPermissions.isBlank() || revokedPermissions.equals("[]")) {
            return new ArrayList<>();
        }
        try {
            return com.datansh.EmployeeManagment.util.JsonUtil.fromJsonList(revokedPermissions, String.class);
        } catch (Exception e) {
            String clean = revokedPermissions.replaceAll("[\\[\\]\"\\s]", "");
            return clean.isEmpty() ? new ArrayList<>() : Arrays.asList(clean.split(","));
        }
    }

    public boolean hasPermission(String permissionName) {
        if (Boolean.FALSE.equals(this.isActive)) return false;

        List<String> revoked = getRevokedPermissionsList();
        if (revoked.contains(permissionName)) return false;

        List<String> custom = getCustomPermissionsList();
        if (custom.contains(permissionName)) return true;

        if (userRoles == null) return false;
        for (UserRole ur : userRoles) {
            Role role = ur.getRole();
            if ("Admin".equalsIgnoreCase(role.getRoleName())) {
                return true;
            }
            if (role.getRolePermissions() != null) {
                for (RolePermission rp : role.getRolePermissions()) {
                    String pName = rp.getPermission().getPermissionName();
                    if ("role:manage".equalsIgnoreCase(pName) || pName.equalsIgnoreCase(permissionName)) {
                        return true;
                    }
                    if (permissionName.contains(":view") && pName.equalsIgnoreCase(permissionName.replace(":view", ":read"))) {
                        return true;
                    }
                    if (permissionName.contains(":read") && pName.equalsIgnoreCase(permissionName.replace(":read", ":view"))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
