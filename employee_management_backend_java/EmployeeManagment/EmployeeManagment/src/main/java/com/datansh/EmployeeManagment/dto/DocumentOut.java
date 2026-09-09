package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentOut {
    private String publicId;
    private String employeePublicId;
    private String employeeName;
    private String documentName;
    private String documentType;
    private String documentUrl;
    private Long fileSizeBytes;
    private String status;
    private String verificationNotes;
    private String verifiedByUserId;
    private String verifiedAt;
    private String createdAt;
}
