package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaginatedLeaveRequests {
    private long total;
    private int skip;
    private Integer limit;
    private List<LeaveRequestOut> items;
}
