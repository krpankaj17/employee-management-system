package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HolidayRepository extends JpaRepository<Holiday, Long>, JpaSpecificationExecutor<Holiday> {
    Optional<Holiday> findByPublicId(UUID publicId);
    List<Holiday> findByYearOrderByDateAsc(Integer year);
    Optional<Holiday> findByDate(LocalDate date);
}

