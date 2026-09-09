package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleCreateIn {

    @NotBlank(message = "Role name is required")
    private String roleName;

    private String description;

    private List<String> permissionNames;
}
