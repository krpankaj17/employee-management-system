package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryComponentOut {
    private String componentName;
    private String componentType;
    private BigDecimal amount;
}
