package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForgotPasswordIn {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;
}
