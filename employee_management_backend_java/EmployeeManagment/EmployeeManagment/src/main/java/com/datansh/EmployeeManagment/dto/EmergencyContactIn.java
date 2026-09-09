package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmergencyContactIn {

    @NotBlank(message = "Contact name is required")
    private String contactName;

    @NotBlank(message = "Relationship is required")
    private String relationship;

    @NotBlank(message = "Phone is required")
    private String phone;

    private String email;

    @Builder.Default
    private Boolean isPrimary = false;
}
