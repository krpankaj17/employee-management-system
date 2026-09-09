package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollProcessIn {

    private String employeePublicId;

    @NotNull(message = "Pay period start date is required")
    private LocalDate payPeriodStart;

    @NotNull(message = "Pay period end date is required")
    private LocalDate payPeriodEnd;

    private LocalDate paymentDate;
    private String paymentMethod;
}
