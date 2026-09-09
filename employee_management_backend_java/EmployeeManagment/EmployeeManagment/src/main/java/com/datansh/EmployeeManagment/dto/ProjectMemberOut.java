package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectMemberOut {
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private String roleInProject;
    private String assignedAt;
}
