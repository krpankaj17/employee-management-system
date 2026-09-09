package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class YearlyAttendanceSummary {
    private String employeePublicId;
    private String employeeName;
    private int year;
    private int totalDaysPresent;
    private int totalDaysHalfDay;
    private int totalDaysOnLeave;
    private int totalDaysAbsent;
    private BigDecimal totalAnnualHours;
    private BigDecimal avgMonthlyHours;
    private List<MonthlyBreakdownItem> monthlyBreakdown;
}
