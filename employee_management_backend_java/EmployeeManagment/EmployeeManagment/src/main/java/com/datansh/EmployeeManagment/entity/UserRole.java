package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "user_roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserRole {

    @EmbeddedId
    private UserRoleId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @MapsId("roleId")
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "assigned_at", nullable = false)
    private OffsetDateTime assignedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static class UserRoleBuilder {
        public UserRole build() {
            if (this.id == null && this.user != null && this.role != null) {
                this.id = new UserRoleId(this.user.getUserId(), this.role.getRoleId());
            }
            OffsetDateTime now = OffsetDateTime.now();
            if (this.assignedAt == null) {
                this.assignedAt = now;
            }
            if (this.createdAt == null) {
                this.createdAt = now;
            }
            if (this.updatedAt == null) {
                this.updatedAt = now;
            }
            return new UserRole(this.id, this.user, this.role, this.assignedAt, this.createdAt, this.updatedAt);
        }
    }

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (this.assignedAt == null) {
            this.assignedAt = now;
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
        if (this.id == null && this.user != null && this.role != null) {
            this.id = new UserRoleId(this.user.getUserId(), this.role.getRoleId());
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
