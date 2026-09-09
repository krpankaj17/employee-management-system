package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.NotificationRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRecipientRepository extends JpaRepository<NotificationRecipient, Long> {
    List<NotificationRecipient> findByEmployeeEmpIdOrderByCreatedAtDesc(Long empId);
    List<NotificationRecipient> findByEmployeePublicIdOrderByCreatedAtDesc(UUID employeePublicId);
    List<NotificationRecipient> findByEmployeeEmpIdAndStatus(Long empId, String status);
    List<NotificationRecipient> findByEmployeePublicIdAndStatus(UUID employeePublicId, String status);
    Optional<NotificationRecipient> findByRecipientIdAndEmployeePublicId(Long recipientId, UUID employeePublicId);
}
