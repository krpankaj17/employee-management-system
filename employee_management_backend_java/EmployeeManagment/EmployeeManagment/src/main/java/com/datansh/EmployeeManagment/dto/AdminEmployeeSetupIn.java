package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminEmployeeSetupIn {
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
    private String designationPublicId;
    private String reportingManagerPublicId;
    private String timezone;
    private List<AddressIn> addresses;
    private List<EmergencyContactIn> emergencyContacts;
    private BankDetailIn bankDetail;
    private SalaryCreateIn salary;
}
