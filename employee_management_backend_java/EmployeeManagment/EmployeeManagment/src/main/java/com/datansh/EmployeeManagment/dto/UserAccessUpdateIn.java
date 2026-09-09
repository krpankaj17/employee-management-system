package com.datansh.EmployeeManagment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccessUpdateIn {
    private List<String> roles;
    private List<String> customPermissions;
    private List<String> revokedPermissions;
    private Boolean isActive;
}
