package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "employee_leave_balances", indexes = {
    @Index(name = "idx_elb_public_id", columnList = "public_id"),
    @Index(name = "idx_elb_emp_year", columnList = "employee_id, year")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeLeaveBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "balance_id")
    private Long balanceId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "leave_type_id", nullable = false)
    private LeaveType leaveType;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "total_allocated", nullable = false)
    @Builder.Default
    private Integer totalAllocated = 0;

    @Column(name = "used_leaves", nullable = false)
    @Builder.Default
    private Integer usedLeaves = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

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
        if (this.totalAllocated == null) {
            this.totalAllocated = 0;
        }
        if (this.usedLeaves == null) {
            this.usedLeaves = 0;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public int getRemainingLeaves() {
        return (totalAllocated != null ? totalAllocated : 0) - (usedLeaves != null ? usedLeaves : 0);
    }
}
