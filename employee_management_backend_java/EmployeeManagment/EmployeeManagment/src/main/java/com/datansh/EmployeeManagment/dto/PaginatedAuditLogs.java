package com.datansh.EmployeeManagment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaginatedAuditLogs {
    private long total;
    private int skip;
    private Integer limit;
    private List<AuditLogOut> items;
}
