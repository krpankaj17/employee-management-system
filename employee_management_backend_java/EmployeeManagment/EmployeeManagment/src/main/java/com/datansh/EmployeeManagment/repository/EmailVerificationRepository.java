package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {
    Optional<EmailVerification> findFirstByEmailOrderByIdDesc(String email);
    List<EmailVerification> findByEmail(String email);
    void deleteAllByEmail(String email);
}
