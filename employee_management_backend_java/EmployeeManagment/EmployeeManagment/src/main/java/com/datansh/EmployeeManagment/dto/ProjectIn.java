package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectIn {

    @NotBlank(message = "Project name is required")
    private String projectName;

    private String description;
    private String projectHeadPublicId;
    private String headEmployeePublicId;
    private LocalDate startDate;
    private LocalDate endDate;

    @Builder.Default
    private String status = "planning"; // planning, active, on_hold, completed, cancelled

    public String getEffectiveProjectHeadPublicId() {
        if (projectHeadPublicId != null) {
            return projectHeadPublicId;
        }
        return headEmployeePublicId;
    }
}
