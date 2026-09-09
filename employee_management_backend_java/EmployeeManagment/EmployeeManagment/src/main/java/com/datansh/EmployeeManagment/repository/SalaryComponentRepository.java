package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.SalaryComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalaryComponentRepository extends JpaRepository<SalaryComponent, Long> {
    List<SalaryComponent> findBySalarySalaryId(Long salaryId);
}
