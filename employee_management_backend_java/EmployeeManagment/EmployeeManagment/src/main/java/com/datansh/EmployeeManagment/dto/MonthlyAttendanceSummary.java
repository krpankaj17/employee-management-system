package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyAttendanceSummary {
    private String employeePublicId;
    private String employeeName;
    private int year;
    private int month;
    private String monthName;
    private int daysInMonth;
    private int totalDaysLogged;
    private int daysPresent;
    private int daysHalfDay;
    private int daysOnLeave;
    private int daysAbsent;
    private BigDecimal totalHoursWorked;
    private BigDecimal avgDailyHours;
    private List<AttendanceOut> records;
}
