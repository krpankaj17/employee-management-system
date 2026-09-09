package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.EmployeeLeaveBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeLeaveBalanceRepository extends JpaRepository<EmployeeLeaveBalance, Long> {
    Optional<EmployeeLeaveBalance> findByPublicId(UUID publicId);
    List<EmployeeLeaveBalance> findByEmployeeEmpIdAndYear(Long empId, Integer year);
    List<EmployeeLeaveBalance> findByEmployeePublicIdAndYear(UUID employeePublicId, Integer year);
    Optional<EmployeeLeaveBalance> findByEmployeeEmpIdAndLeaveTypeLeaveTypeIdAndYear(Long empId, Long leaveTypeId, Integer year);
    Optional<EmployeeLeaveBalance> findByEmployeePublicIdAndLeaveTypePublicIdAndYear(UUID employeePublicId, UUID leaveTypePublicId, Integer year);
}
