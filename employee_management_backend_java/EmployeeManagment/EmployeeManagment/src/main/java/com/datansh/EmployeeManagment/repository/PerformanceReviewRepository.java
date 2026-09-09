package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.PerformanceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Long>, JpaSpecificationExecutor<PerformanceReview> {
    Optional<PerformanceReview> findByPublicId(UUID publicId);
    List<PerformanceReview> findByEmployeeEmpId(Long empId);
    List<PerformanceReview> findByEmployeePublicId(UUID employeePublicId);
    List<PerformanceReview> findByReviewerEmpId(Long reviewerEmpId);
    List<PerformanceReview> findByReviewerPublicId(UUID reviewerPublicId);
}

