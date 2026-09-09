package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeFullProfileOut {
    private String publicId;
    private String employeeCode;
    private String firstName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String email;
    private String phone;
    private String secondaryEmail;
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
    private List<AddressOut> addresses;
    private List<EmergencyContactOut> emergencyContacts;
    private SalaryOut currentSalary;
    private BankDetailOut primaryBankDetail;
}
