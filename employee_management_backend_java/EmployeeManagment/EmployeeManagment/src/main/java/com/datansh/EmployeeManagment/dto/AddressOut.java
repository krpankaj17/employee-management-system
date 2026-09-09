package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressOut {
    private String publicId;
    private String streetAddress;
    private String city;
    private String state;
    private String country;
    private String pincode;
    private String formattedAddress;
    private String addressType;
    private Boolean isPrimary;
}
