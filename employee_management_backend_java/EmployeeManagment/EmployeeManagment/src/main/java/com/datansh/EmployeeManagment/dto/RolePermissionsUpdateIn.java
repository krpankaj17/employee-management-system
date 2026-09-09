package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RolePermissionsUpdateIn {

    @NotEmpty(message = "At least one permission name must be provided")
    private List<String> permissionNames;
}
