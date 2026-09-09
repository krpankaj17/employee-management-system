package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeOut {
    private String publicId;
    private String employeeCode;
    private String firstName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String email;
    private String phone;
    private LocalDate joiningDate;
    private String employeeStatus;
    private String employmentType;
    private String departmentPublicId;
    private String departmentName;
    private String designationPublicId;
    private String designationName;
    private String reportingManagerPublicId;
    private String timezone;
    private Boolean isActive;
}
