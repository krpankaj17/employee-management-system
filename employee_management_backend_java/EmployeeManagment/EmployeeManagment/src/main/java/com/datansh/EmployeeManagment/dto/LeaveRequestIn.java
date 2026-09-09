package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequestIn {

    private String employeePublicId;

    @NotBlank(message = "Leave type public ID is required")
    private String leaveTypePublicId;

    @NotNull(message = "Start date is required")
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    private LocalDate endDate;

    private String reason;
}
