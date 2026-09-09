package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    Optional<Announcement> findByPublicId(UUID publicId);
    List<Announcement> findByIsActiveTrueOrderByCreatedAtDesc();

    @Query("SELECT a FROM Announcement a WHERE a.isActive = true AND (a.targetType = 'all' OR (a.targetDepartment.deptId = :deptId)) ORDER BY a.createdAt DESC")
    List<Announcement> findActiveForDepartment(@Param("deptId") Long deptId);
}
