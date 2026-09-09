package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollRunOut {
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private String departmentName;
    private String designationTitle;
    private String salaryPublicId;
    private String payPeriodStart;
    private String payPeriodEnd;
    private BigDecimal grossAmount;
    private BigDecimal totalDeductions;
    private BigDecimal netPaid;
    private String paymentDate;
    private String paymentStatus;
    private String paymentMethod;
    private String transactionRef;
}
