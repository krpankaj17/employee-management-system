package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.ProjectMember;
import com.datansh.EmployeeManagment.entity.ProjectMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMemberId> {
    List<ProjectMember> findByProjectProjectId(Long projectId);
    List<ProjectMember> findByProjectPublicId(UUID projectPublicId);
    List<ProjectMember> findByEmployeeEmpId(Long empId);
    List<ProjectMember> findByEmployeePublicId(UUID employeePublicId);
    Optional<ProjectMember> findByProjectPublicIdAndEmployeePublicId(UUID projectPublicId, UUID employeePublicId);
}
