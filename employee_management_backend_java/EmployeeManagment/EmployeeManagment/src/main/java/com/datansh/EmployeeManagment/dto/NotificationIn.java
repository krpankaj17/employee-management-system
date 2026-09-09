package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationIn {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Message is required")
    private String message;

    @Builder.Default
    private String notificationType = "general";

    @Builder.Default
    private String targetType = "all"; // employee, department, all

    private String targetEmployeePublicId;
    private String targetDepartmentPublicId;
}
