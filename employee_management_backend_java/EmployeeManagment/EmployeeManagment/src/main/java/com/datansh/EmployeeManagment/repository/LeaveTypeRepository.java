package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LeaveTypeRepository extends JpaRepository<LeaveType, Long> {
    Optional<LeaveType> findByName(String name);
    Optional<LeaveType> findByPublicId(UUID publicId);
    boolean existsByName(String name);
}
