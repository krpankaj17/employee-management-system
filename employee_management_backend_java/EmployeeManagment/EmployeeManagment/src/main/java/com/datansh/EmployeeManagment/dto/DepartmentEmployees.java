package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentEmployees {
    private String departmentPublicId;
    private Long total;
    private Integer skip;
    private Integer limit;
    private List<DepartmentEmployeeOut> items;
}
