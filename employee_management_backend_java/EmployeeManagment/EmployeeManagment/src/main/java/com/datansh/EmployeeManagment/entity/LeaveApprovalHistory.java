package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "leave_approval_history", indexes = {
    @Index(name = "idx_lah_leave_id", columnList = "leave_id"),
    @Index(name = "idx_lah_action_by", columnList = "action_by")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaveApprovalHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leave_id", nullable = false)
    private LeaveRequest leaveRequest;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "action_by", nullable = false)
    private Employee actionBy;

    @Column(name = "action", nullable = false, length = 20)
    private String action; // 'submitted', 'approved', 'rejected', 'escalated', 'cancelled'

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "action_at", nullable = false)
    private OffsetDateTime actionAt;

    @PrePersist
    public void prePersist() {
        if (this.actionAt == null) {
            this.actionAt = OffsetDateTime.now();
        }
    }
}
