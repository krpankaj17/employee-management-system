package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmergencyContactOut {
    private Long contactId;
    private String contactName;
    private String relationship;
    private String phone;
    private String email;
    private Boolean isPrimary;
}
