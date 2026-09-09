package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentIn {

    @NotBlank(message = "Department name is required")
    @Size(max = 100, message = "Department name must not exceed 100 characters")
    private String deptName;

    @NotBlank(message = "Department code is required")
    @Size(max = 10, message = "Department code must not exceed 10 characters")
    private String deptCode;

    private String description;
    private String headEmployeePublicId;
}
