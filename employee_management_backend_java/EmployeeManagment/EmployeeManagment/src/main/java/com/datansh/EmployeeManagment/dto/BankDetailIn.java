package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankDetailIn {

    private String employeePublicId;

    @NotBlank(message = "Bank name is required")
    private String bankName;

    private String branchName;

    @NotBlank(message = "Account number is required")
    private String accountNumber;

    @NotBlank(message = "Routing code is required")
    private String routingCode;

    @Builder.Default
    private String accountType = "savings";

    @Builder.Default
    private Boolean isPrimary = true;
}
