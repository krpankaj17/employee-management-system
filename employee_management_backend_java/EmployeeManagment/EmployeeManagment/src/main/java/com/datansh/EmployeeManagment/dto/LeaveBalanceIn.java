package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveBalanceIn {

    @NotBlank(message = "Employee public ID is required")
    private String employeePublicId;

    @NotBlank(message = "Leave type public ID is required")
    private String leaveTypePublicId;

    @NotNull(message = "Year is required")
    private Integer year;

    @NotNull(message = "Allocated days is required")
    private Integer allocatedDays;
}
