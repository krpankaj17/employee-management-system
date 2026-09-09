package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectMemberId implements Serializable {

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "employee_id")
    private Long employeeId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProjectMemberId that = (ProjectMemberId) o;
        return Objects.equals(projectId, that.projectId) && Objects.equals(employeeId, that.employeeId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(projectId, employeeId);
    }
}
