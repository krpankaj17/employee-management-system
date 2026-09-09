package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogOut {
    private Long logId;
    private String userEmail;
    private String userPublicId;
    private String action;
    private String entityName;
    private String entityId;
    private String oldValues;
    private String newValues;
    private OffsetDateTime createdAt;
}
