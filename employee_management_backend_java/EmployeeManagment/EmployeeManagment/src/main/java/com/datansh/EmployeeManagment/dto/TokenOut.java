package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenOut {

    @JsonProperty("access_token")
    @JsonAlias({"accessToken", "access_token"})
    private String accessToken;

    @JsonProperty("refresh_token")
    @JsonAlias({"refreshToken", "refresh_token"})
    private String refreshToken;

    @JsonProperty("token_type")
    @JsonAlias({"tokenType", "token_type"})
    private String tokenType;

    @JsonProperty("expires_in")
    @JsonAlias({"expiresIn", "expires_in"})
    private Long expiresIn;

    private UserProfileOut user;
    private List<String> permissions;
    private List<String> roles;
}

