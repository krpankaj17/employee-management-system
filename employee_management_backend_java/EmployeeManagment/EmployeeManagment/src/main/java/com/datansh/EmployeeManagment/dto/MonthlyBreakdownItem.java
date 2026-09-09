package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyBreakdownItem {
    private int month;
    private String monthName;
    private int daysPresent;
    private int daysHalfDay;
    private int daysOnLeave;
    private int daysAbsent;
    private BigDecimal totalHoursWorked;
    private BigDecimal avgDailyHours;
}
