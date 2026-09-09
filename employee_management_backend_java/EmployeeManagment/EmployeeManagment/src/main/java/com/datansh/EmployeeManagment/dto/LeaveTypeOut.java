package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveTypeOut {
    private String publicId;
    private String name;
    private String description;
    private Integer maxDaysPerYear;
    private Boolean isPaid;
}
