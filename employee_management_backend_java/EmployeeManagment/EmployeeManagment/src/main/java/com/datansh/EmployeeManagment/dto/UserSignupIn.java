package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSignupIn {

    @NotBlank(message = "Display name is required")
    @Size(max = 200, message = "Display name must not exceed 200 characters")
    @JsonProperty("display_name")
    @JsonAlias({"displayName", "display_name"})
    private String displayName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Size(max = 255, message = "Email must not exceed 255 characters")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 128, message = "Password must be between 6 and 128 characters")
    private String password;

    @NotBlank(message = "Verification OTP is required")
    @Size(min = 6, max = 6, message = "OTP must be exactly 6 digits")
    @Schema(description = "6-digit verification code received via email", example = "123456")
    private String otp;

    @Email(message = "Invalid secondary email format")
    @JsonProperty("secondary_email")
    @JsonAlias({"secondaryEmail", "secondary_email"})
    private String secondaryEmail;
}
