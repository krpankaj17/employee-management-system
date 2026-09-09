package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByRoleName(String roleName);
    Optional<Role> findByPublicId(UUID publicId);
    boolean existsByRoleName(String roleName);
}
