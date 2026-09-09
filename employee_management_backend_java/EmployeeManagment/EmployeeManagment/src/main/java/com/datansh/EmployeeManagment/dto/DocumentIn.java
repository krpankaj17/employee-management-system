package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentIn {

    @NotBlank(message = "Employee public ID is required")
    private String employeePublicId;

    @NotBlank(message = "Document name is required")
    private String documentName;

    @NotBlank(message = "Document type is required")
    private String documentType; // aadhaar, pan, passport, resume, offer_letter, experience_letter, other

    @NotBlank(message = "Document URL is required")
    private String documentUrl;

    private Long fileSizeBytes;
}
