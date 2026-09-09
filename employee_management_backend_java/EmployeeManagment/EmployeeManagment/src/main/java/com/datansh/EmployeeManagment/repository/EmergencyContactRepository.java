package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, Long> {
    List<EmergencyContact> findByEmployeeEmpId(Long empId);
    List<EmergencyContact> findByEmployeePublicId(UUID employeePublicId);
    Optional<EmergencyContact> findByContactIdAndEmployeePublicId(Long contactId, UUID employeePublicId);
}
