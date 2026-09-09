package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.PayrollRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayrollRunRepository extends JpaRepository<PayrollRun, Long>, JpaSpecificationExecutor<PayrollRun> {
    Optional<PayrollRun> findByPublicId(UUID publicId);
    List<PayrollRun> findByEmployeeEmpId(Long empId);
    List<PayrollRun> findByEmployeePublicId(UUID employeePublicId);
}
