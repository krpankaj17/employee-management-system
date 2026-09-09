package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequestOut {
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String leaveTypePublicId;
    private String leaveTypeName;
    private String startDate;
    private String endDate;
    private BigDecimal totalDays;
    private String reason;
    private String status;
    private String approvedByPublicId;
    private String rejectionReason;
    private List<LeaveApprovalHistoryOut> history;
}
