package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long>, JpaSpecificationExecutor<Department> {
    Optional<Department> findByPublicId(UUID publicId);
    Optional<Department> findByDeptCode(String deptCode);
    Optional<Department> findByDeptName(String deptName);
    boolean existsByDeptCode(String deptCode);
    boolean existsByDeptName(String deptName);
}

