package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollDisburseIn {

    @NotBlank(message = "Payment method is required")
    private String paymentMethod; // bank_transfer, cheque, cash

    @NotNull(message = "Payment date is required")
    private LocalDate paymentDate;

    private String transactionRef;
}
