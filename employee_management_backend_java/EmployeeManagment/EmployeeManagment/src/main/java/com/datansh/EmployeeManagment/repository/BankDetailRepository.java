package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.BankDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BankDetailRepository extends JpaRepository<BankDetail, Long> {
    Optional<BankDetail> findByPublicId(UUID publicId);
    List<BankDetail> findByEmployeeEmpId(Long empId);
    List<BankDetail> findByEmployeePublicId(UUID employeePublicId);
    Optional<BankDetail> findByEmployeeEmpIdAndIsPrimaryTrue(Long empId);
    Optional<BankDetail> findByEmployeePublicIdAndIsPrimaryTrue(UUID employeePublicId);
}
