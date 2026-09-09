package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceOut {
    private Long id;
    private Long attendanceId;
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private String departmentName;
    private String date;
    private String checkIn;
    private String checkOut;
    private String timezone;
    private String workMode;
    private String status;
    private BigDecimal totalHours;
    private Boolean isLate;
    private Integer lateMinutes;
    private String notes;

    public String getCheckInTime() {
        return checkIn;
    }

    public String getCheckOutTime() {
        return checkOut;
    }
}
