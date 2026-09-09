package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeProfileIn {
    private String firstName;
    private String lastName;
    private LocalDate dateOfBirth;
    private String gender;
    private String phone;
    private String timezone;
    private List<AddressIn> addresses;
    private List<EmergencyContactIn> emergencyContacts;
}
