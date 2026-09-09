package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryOut {
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private String departmentName;
    private BigDecimal basicSalary;
    private BigDecimal netSalary;
    private String currency;
    private String effectiveFrom;
    private String effectiveTo;
    private List<SalaryComponentOut> components;
}
