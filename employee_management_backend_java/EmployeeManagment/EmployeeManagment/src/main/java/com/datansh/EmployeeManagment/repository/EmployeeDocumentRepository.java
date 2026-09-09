package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.EmployeeDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, Long> {
    Optional<EmployeeDocument> findByPublicId(UUID publicId);
    List<EmployeeDocument> findByEmployeeEmpId(Long empId);
    List<EmployeeDocument> findByEmployeePublicId(UUID employeePublicId);
    List<EmployeeDocument> findByStatusInOrderByUploadedAtDesc(List<String> statuses);
}
