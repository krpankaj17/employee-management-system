package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleAssignIn {

    @NotEmpty(message = "At least one role name must be provided")
    private List<String> roleNames;
}
