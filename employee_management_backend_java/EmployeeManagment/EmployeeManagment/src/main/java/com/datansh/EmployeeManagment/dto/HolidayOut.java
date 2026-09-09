package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HolidayOut {
    private String publicId;
    private String name;
    private LocalDate date;
    private String holidayType;
    private Integer year;
    private Boolean isOptional;
    private String applicableRegion;
}
