package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "project_members", indexes = {
    @Index(name = "idx_project_members_project_id", columnList = "project_id"),
    @Index(name = "idx_project_members_employee_id", columnList = "employee_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectMember {

    @EmbeddedId
    private ProjectMemberId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("projectId")
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.EAGER)
    @MapsId("employeeId")
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "role_in_project", length = 100)
    private String roleInProject;

    @Column(name = "assigned_at", nullable = false)
    private OffsetDateTime assignedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public static class ProjectMemberBuilder {
        public ProjectMember build() {
            if (this.id == null && this.project != null && this.employee != null) {
                this.id = new ProjectMemberId(this.project.getProjectId(), this.employee.getEmpId());
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
            return new ProjectMember(this.id, this.project, this.employee, this.roleInProject, this.assignedAt, this.createdAt, this.updatedAt);
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
        if (this.id == null && this.project != null && this.employee != null) {
            this.id = new ProjectMemberId(this.project.getProjectId(), this.employee.getEmpId());
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
