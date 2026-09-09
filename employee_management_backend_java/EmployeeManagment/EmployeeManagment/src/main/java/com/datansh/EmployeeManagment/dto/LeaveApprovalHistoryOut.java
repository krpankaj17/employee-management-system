package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveApprovalHistoryOut {
    private String action;
    private String actionByPublicId;
    private String actionByName;
    private String actionAt;
    private String remarks;
}
