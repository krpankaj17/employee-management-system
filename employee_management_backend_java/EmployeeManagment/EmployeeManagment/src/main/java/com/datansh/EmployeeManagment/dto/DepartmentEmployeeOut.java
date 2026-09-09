package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentEmployeeOut {
    private String publicId;
    private String employeeCode;
    private String firstName;
    private String lastName;
    private String email;
    private String employeeStatus;
}
