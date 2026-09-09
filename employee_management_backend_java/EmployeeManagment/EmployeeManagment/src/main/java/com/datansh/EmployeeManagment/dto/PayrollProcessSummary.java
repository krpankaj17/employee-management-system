package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollProcessSummary {
    private int totalEmployeesProcessed;
    private BigDecimal totalGrossDisbursed;
    private BigDecimal totalDeductions;
    private BigDecimal totalNetDisbursed;
    private List<PayrollRunOut> processedRuns;
}
