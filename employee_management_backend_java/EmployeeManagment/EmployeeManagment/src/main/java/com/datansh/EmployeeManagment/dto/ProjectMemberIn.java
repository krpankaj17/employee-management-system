package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectMemberIn {

    @NotBlank(message = "Employee public ID is required")
    private String employeePublicId;

    private String roleInProject;
}
