package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryHistoryOut {
    private String employeePublicId;
    private String employeeName;
    private String employeeCode;
    private SalaryOut activeSalary;
    private List<SalaryOut> history;
}
