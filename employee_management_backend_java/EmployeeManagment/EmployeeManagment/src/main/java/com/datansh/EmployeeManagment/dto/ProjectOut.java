package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectOut {
    private String publicId;
    private String projectName;
    private String description;
    private String projectHeadPublicId;
    private String projectHeadName;
    private String headEmployeePublicId;
    private String headEmployeeName;
    private String startDate;
    private String endDate;
    private String status;
    private int memberCount;
    private int membersCount;
    private List<ProjectMemberOut> members;
}
