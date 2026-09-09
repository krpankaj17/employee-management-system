package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByPermissionName(String permissionName);
    Optional<Permission> findByPublicId(UUID publicId);
    boolean existsByPermissionName(String permissionName);
}
