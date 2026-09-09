package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.LeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long>, JpaSpecificationExecutor<LeaveRequest> {
    Optional<LeaveRequest> findByPublicId(UUID publicId);
    List<LeaveRequest> findByEmployeeEmpId(Long empId);
    List<LeaveRequest> findByEmployeePublicId(UUID employeePublicId);
}
