package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementOut {
    private String publicId;
    private String title;
    private String content;
    private String priority;
    private String targetType;
    private String targetDepartment;
    private String targetDepartmentPublicId;
    private String authorName;
    private String authorPublicId;
    private Boolean isActive;
    private String expiresAt;
}
