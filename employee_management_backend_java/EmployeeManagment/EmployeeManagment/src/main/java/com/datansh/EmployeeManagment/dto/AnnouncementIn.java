package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementIn {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Content is required")
    private String content;

    @Builder.Default
    private String priority = "normal"; // low, normal, high, urgent

    @Builder.Default
    private String targetType = "all"; // all, department

    private String targetDepartmentPublicId;
    private OffsetDateTime expiresAt;
}
