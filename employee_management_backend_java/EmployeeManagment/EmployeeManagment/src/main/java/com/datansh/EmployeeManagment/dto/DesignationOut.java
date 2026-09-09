package com.datansh.EmployeeManagment.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DesignationOut {
    private String publicId;
    private String title;
    private String gradeLevel;
    private String description;

    public String getDesignationName() {
        return title;
    }
}
