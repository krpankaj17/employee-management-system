package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "bank_details", indexes = {
    @Index(name = "idx_bank_details_public_id", columnList = "public_id"),
    @Index(name = "idx_bank_details_emp_id", columnList = "emp_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "bank_detail_id")
    private Long bankDetailId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    @Column(name = "bank_name", nullable = false, length = 150)
    private String bankName;

    @Column(name = "branch_name", length = 150)
    private String branchName;

    @Column(name = "account_number", nullable = false, length = 34)
    private String accountNumber;

    @Column(name = "routing_code", nullable = false, length = 20)
    private String routingCode;

    @Column(name = "account_type", length = 20)
    @Builder.Default
    private String accountType = "savings"; // 'savings' or 'current'

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private Boolean isPrimary = true;

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
        if (this.accountType == null) {
            this.accountType = "savings";
        }
        if (this.isPrimary == null) {
            this.isPrimary = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
