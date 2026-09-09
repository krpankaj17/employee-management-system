package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryComponentIn {

    @NotBlank(message = "Component name is required")
    private String componentName;

    @NotBlank(message = "Component type is required (earning or deduction)")
    private String componentType; // 'earning' or 'deduction'

    @NotNull(message = "Amount is required")
    private BigDecimal amount;
}
