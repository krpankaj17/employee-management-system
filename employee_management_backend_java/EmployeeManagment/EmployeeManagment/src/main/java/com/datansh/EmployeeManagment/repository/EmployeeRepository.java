package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> {
    Optional<Employee> findByPublicId(UUID publicId);
    Optional<Employee> findByEmail(String email);
    Optional<Employee> findByEmployeeCode(String employeeCode);
    Optional<Employee> findByUserUserId(Long userId);
    Optional<Employee> findByUserPublicId(UUID userPublicId);
    boolean existsByEmail(String email);
    boolean existsByEmployeeCode(String employeeCode);
    boolean existsByPhone(String phone);
    List<Employee> findByDepartmentDeptId(Long deptId);
    long countByDepartmentDeptId(Long deptId);
    List<Employee> findByReportingManagerEmpId(Long managerEmpId);
}
