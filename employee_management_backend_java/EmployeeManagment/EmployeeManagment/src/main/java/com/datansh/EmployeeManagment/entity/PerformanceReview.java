package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "performance_reviews", indexes = {
    @Index(name = "idx_pr_public_id", columnList = "public_id"),
    @Index(name = "idx_pr_emp_id", columnList = "emp_id"),
    @Index(name = "idx_pr_reviewer_id", columnList = "reviewer_id"),
    @Index(name = "idx_pr_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerformanceReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Long reviewId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private Employee reviewer;

    @Column(name = "review_period_start", nullable = false)
    private LocalDate reviewPeriodStart;

    @Column(name = "review_period_end", nullable = false)
    private LocalDate reviewPeriodEnd;

    @Column(name = "rating", precision = 3, scale = 1)
    private BigDecimal rating;

    @Column(name = "comments", columnDefinition = "TEXT")
    private String comments;

    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "draft"; // 'draft', 'submitted', 'acknowledged', 'finalized'

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
        if (this.status == null) {
            this.status = "draft";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
