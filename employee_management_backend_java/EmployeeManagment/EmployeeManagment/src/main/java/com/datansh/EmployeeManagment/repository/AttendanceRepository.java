package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long>, JpaSpecificationExecutor<Attendance> {
    Optional<Attendance> findByPublicId(UUID publicId);
    Optional<Attendance> findByEmployeeEmpIdAndDate(Long empId, LocalDate date);
    Optional<Attendance> findByEmployeePublicIdAndDate(UUID employeePublicId, LocalDate date);

    Optional<Attendance> findFirstByEmployeeEmpIdAndCheckInIsNotNullAndCheckOutIsNullOrderByDateDescCheckInDesc(Long empId);

    @Query("SELECT a FROM Attendance a WHERE a.employee.empId = :empId AND a.date >= :startDate AND a.date <= :endDate ORDER BY a.date ASC")
    List<Attendance> findByEmployeeAndDateRange(@Param("empId") Long empId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
