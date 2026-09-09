package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaveTypeIn {

    @NotBlank(message = "Leave type name is required")
    private String name;

    private String description;

    @Builder.Default
    private Integer maxDaysPerYear = 0;

    @Builder.Default
    private Boolean isPaid = true;
}
