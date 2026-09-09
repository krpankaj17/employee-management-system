package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenRefreshIn {

    @NotBlank(message = "Refresh token is required")
    @JsonProperty("refresh_token")
    @JsonAlias({"refreshToken", "refresh_token"})
    private String refreshToken;
}

