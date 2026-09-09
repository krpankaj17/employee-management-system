package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {
    List<AuditLog> findAllByOrderByCreatedAtDesc();
    List<AuditLog> findByEntityNameOrderByCreatedAtDesc(String entityName);
}

