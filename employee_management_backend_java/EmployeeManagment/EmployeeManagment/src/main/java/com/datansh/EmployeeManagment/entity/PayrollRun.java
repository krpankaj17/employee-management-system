package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payroll_runs", indexes = {
    @Index(name = "idx_payroll_runs_public_id", columnList = "public_id"),
    @Index(name = "idx_payroll_runs_emp", columnList = "emp_id"),
    @Index(name = "idx_payroll_runs_period", columnList = "pay_period_start, pay_period_end"),
    @Index(name = "idx_payroll_runs_status", columnList = "payment_status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "payroll_id")
    private Long payrollId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emp_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "salary_id")
    private Salary salary;

    @Column(name = "pay_period_start", nullable = false)
    private LocalDate payPeriodStart;

    @Column(name = "pay_period_end", nullable = false)
    private LocalDate payPeriodEnd;

    @Column(name = "gross_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal grossAmount = BigDecimal.ZERO;

    @Column(name = "total_deductions", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalDeductions = BigDecimal.ZERO;

    @Column(name = "net_paid", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal netPaid = BigDecimal.ZERO;

    @Column(name = "payment_date")
    private LocalDate paymentDate;

    @Column(name = "payment_status", length = 20)
    @Builder.Default
    private String paymentStatus = "pending"; // 'pending', 'processed', 'paid', 'failed'

    @Column(name = "payment_method", length = 20)
    private String paymentMethod; // 'bank_transfer', 'cheque', 'cash'

    @Column(name = "transaction_ref", length = 100)
    private String transactionRef;

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
        if (this.grossAmount == null) {
            this.grossAmount = BigDecimal.ZERO;
        }
        if (this.totalDeductions == null) {
            this.totalDeductions = BigDecimal.ZERO;
        }
        if (this.netPaid == null) {
            this.netPaid = BigDecimal.ZERO;
        }
        if (this.paymentStatus == null) {
            this.paymentStatus = "pending";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
