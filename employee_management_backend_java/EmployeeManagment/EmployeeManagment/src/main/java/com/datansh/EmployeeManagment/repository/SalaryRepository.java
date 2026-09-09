package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Salary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SalaryRepository extends JpaRepository<Salary, Long> {
    Optional<Salary> findByPublicId(UUID publicId);
    List<Salary> findByEmployeeEmpIdOrderByEffectiveFromDesc(Long empId);
    List<Salary> findByEmployeePublicIdOrderByEffectiveFromDesc(UUID employeePublicId);
    Optional<Salary> findFirstByEmployeeEmpIdAndEffectiveToIsNullOrderByEffectiveFromDesc(Long empId);
    Optional<Salary> findFirstByEmployeePublicIdAndEffectiveToIsNullOrderByEffectiveFromDesc(UUID employeePublicId);

    @Query("SELECT DISTINCT s FROM Salary s " +
           "LEFT JOIN FETCH s.components " +
           "JOIN FETCH s.employee e " +
           "LEFT JOIN FETCH e.department " +
           "WHERE s.effectiveTo IS NULL " +
           "ORDER BY s.effectiveFrom DESC")
    List<Salary> findAllActiveSalariesWithDetails();
}
