package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentOut {
    private String publicId;
    private String deptName;
    private String deptCode;
    private String description;
    private String headEmployeePublicId;
    private String headEmployeeName;
    private Long employeeCount;
}
