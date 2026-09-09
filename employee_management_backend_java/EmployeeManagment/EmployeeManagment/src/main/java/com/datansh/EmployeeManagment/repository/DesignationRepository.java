package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Designation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DesignationRepository extends JpaRepository<Designation, Long>, JpaSpecificationExecutor<Designation> {
    Optional<Designation> findByPublicId(UUID publicId);
    Optional<Designation> findByTitle(String title);
    boolean existsByTitle(String title);
}

