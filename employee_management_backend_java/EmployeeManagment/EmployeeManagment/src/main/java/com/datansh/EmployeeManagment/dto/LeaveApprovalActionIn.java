package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveApprovalActionIn {

    @NotBlank(message = "Action is required (approved, rejected, escalated)")
    private String action; // 'approved', 'rejected', 'escalated'

    private String remarks;
    private String rejectionReason;
}
