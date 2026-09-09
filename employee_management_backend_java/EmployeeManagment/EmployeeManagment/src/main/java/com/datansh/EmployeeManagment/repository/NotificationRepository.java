package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByPublicId(UUID publicId);
}
