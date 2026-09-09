package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayslipOut {
    private String payrollPublicId;
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private String email;
    private String department;
    private String designation;
    private String bankAccountMasked;
    private String bankName;
    private String payPeriodStart;
    private String payPeriodEnd;
    private Integer daysInPeriod;
    private Integer daysPresent;
    private Integer daysHalfDay;
    private Integer daysOnLeave;
    private Integer daysAbsent;
    private BigDecimal basicSalary;
    private List<SalaryComponentOut> earningsBreakdown;
    private List<SalaryComponentOut> deductionsBreakdown;
    private BigDecimal grossAmount;
    private BigDecimal totalDeductions;
    private BigDecimal netPaid;
    private String paymentStatus;
    private String paymentDate;
    private String paymentMethod;
    private String transactionRef;
}
