package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankDetailOut {
    private String publicId;
    private String employeePublicId;
    private String bankName;
    private String branchName;
    private String accountNumber;
    private String routingCode;
    private String accountType;
    private Boolean isPrimary;
}
