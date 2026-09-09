package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileOut {
    private String publicId;
    private String email;
    private String displayName;
    private String secondaryEmail;
    private Boolean isActive;
    private String employeePublicId;
    private String lastLogin;
    private List<String> roles;
    private List<String> permissions;
    private List<String> customPermissions;
    private List<String> revokedPermissions;
}
