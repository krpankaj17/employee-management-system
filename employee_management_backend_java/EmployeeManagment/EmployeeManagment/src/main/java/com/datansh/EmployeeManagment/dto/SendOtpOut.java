package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendOtpOut {

    @Builder.Default
    private Boolean ok = true;

    private String message;

    @Builder.Default
    private Integer expiresInSeconds = 150;

    @Builder.Default
    private Integer resendInSeconds = 150;
}
