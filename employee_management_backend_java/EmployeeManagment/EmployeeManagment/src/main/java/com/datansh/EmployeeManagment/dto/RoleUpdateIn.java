package com.datansh.EmployeeManagment.dto;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleUpdateIn {

    private String roleName;

    private String description;

    private List<String> permissionNames;
}
