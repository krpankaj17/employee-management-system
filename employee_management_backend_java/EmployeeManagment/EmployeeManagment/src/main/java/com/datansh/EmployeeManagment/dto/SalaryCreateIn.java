package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryCreateIn {

    private String employeePublicId;

    @NotNull(message = "Basic salary is required")
    private BigDecimal basicSalary;

    @NotNull(message = "Effective from date is required")
    private LocalDate effectiveFrom;

    @Builder.Default
    private String currency = "INR";

    private List<SalaryComponentIn> components;
}
