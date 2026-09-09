package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeIn {

    private String employeeCode;

    @NotBlank(message = "First name is required")
    private String firstName;

    @NotBlank(message = "Last name is required")
    private String lastName;

    private LocalDate dateOfBirth;
    private String gender;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    private String phone;
    private LocalDate joiningDate;

    @Builder.Default
    private String employeeStatus = "active";

    @Builder.Default
    private String employmentType = "full_time";

    private String departmentPublicId;
    private String designationPublicId;
    private String reportingManagerPublicId;

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private String timezone = "UTC";

    private String userPublicId;
}
