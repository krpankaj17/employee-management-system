package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressIn {

    @NotBlank(message = "Street address is required")
    private String streetAddress;

    @NotBlank(message = "City is required")
    private String city;

    @NotBlank(message = "State is required")
    private String state;

    @Builder.Default
    private String country = "India";

    @NotBlank(message = "Pincode is required")
    private String pincode;

    @Builder.Default
    private String addressType = "current"; // 'current' or 'permanent'

    @Builder.Default
    private Boolean isPrimary = false;
}
