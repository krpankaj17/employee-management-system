package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRecipientOut {
    private Long recipientId;
    private String notificationPublicId;
    private String title;
    private String message;
    private String notificationType;
    private String status;
    private String readAt;
}
