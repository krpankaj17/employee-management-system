package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionOut {
    private String publicId;
    private String permissionName;
    private String description;
}
