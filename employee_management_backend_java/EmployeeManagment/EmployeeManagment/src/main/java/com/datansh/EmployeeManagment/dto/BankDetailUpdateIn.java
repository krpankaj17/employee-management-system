package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankDetailUpdateIn {

    @JsonProperty("bank_name")
    @Schema(description = "Name of the bank", example = "HDFC Bank")
    private String bankName;

    @JsonProperty("branch_name")
    @Schema(description = "Branch location / name", example = "Koramangala, Bengaluru")
    private String branchName;

    @JsonProperty("account_number")
    @Schema(description = "Bank account number", example = "50100458921102")
    private String accountNumber;

    @JsonProperty("routing_code")
    @Schema(description = "IFSC or routing transit number", example = "HDFC0001234")
    private String routingCode;

    @JsonProperty("account_type")
    @Schema(description = "savings | current", example = "savings")
    private String accountType;

    @JsonProperty("is_primary")
    @Schema(description = "Whether this is the primary bank account for salary disbursement", example = "true")
    private Boolean isPrimary;
}
