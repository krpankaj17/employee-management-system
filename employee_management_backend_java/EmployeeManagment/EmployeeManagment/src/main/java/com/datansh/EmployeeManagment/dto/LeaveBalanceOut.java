package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveBalanceOut {
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String leaveTypePublicId;
    private String leaveTypeName;
    private Integer year;
    private Integer totalAllocated;
    private Integer usedLeaves;
    private Integer remainingLeaves;
}
