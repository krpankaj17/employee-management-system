package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "role_permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermission {

    @EmbeddedId
    private RolePermissionId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("roleId")
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @ManyToOne(fetch = FetchType.EAGER)
    @MapsId("permissionId")
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Column(name = "granted_at", nullable = false)
    private OffsetDateTime grantedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static class RolePermissionBuilder {
        public RolePermission build() {
            if (this.id == null && this.role != null && this.permission != null) {
                this.id = new RolePermissionId(this.role.getRoleId(), this.permission.getPermissionId());
            }
            OffsetDateTime now = OffsetDateTime.now();
            if (this.grantedAt == null) {
                this.grantedAt = now;
            }
            if (this.createdAt == null) {
                this.createdAt = now;
            }
            if (this.updatedAt == null) {
                this.updatedAt = now;
            }
            return new RolePermission(this.id, this.role, this.permission, this.grantedAt, this.createdAt, this.updatedAt);
        }
    }

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (this.grantedAt == null) {
            this.grantedAt = now;
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
        if (this.id == null && this.role != null && this.permission != null) {
            this.id = new RolePermissionId(this.role.getRoleId(), this.permission.getPermissionId());
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
