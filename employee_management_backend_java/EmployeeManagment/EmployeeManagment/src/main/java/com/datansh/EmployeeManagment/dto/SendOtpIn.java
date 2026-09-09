package com.datansh.EmployeeManagment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendOtpIn {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Size(min = 5, max = 255, message = "Email must be between 5 and 255 characters")
    @Schema(description = "Valid email address to receive verification OTP", example = "user@example.com")
    private String email;
}
