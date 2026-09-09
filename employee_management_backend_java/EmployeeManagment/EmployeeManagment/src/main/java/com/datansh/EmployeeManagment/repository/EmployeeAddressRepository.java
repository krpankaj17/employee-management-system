package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.EmployeeAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeAddressRepository extends JpaRepository<EmployeeAddress, Long> {
    List<EmployeeAddress> findByEmployeeEmpId(Long empId);
    List<EmployeeAddress> findByEmployeePublicId(UUID employeePublicId);
    Optional<EmployeeAddress> findByEmployeePublicIdAndAddressPublicId(UUID employeePublicId, UUID addressPublicId);
}
