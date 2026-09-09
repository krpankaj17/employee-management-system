package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentVerifyIn {

    @NotBlank(message = "Status is required")
    private String status; // Verified | Rejected | Pending_Verification

    private String verificationNotes;
}
