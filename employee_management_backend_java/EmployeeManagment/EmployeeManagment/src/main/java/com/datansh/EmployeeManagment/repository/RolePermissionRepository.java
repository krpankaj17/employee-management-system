package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.RolePermission;
import com.datansh.EmployeeManagment.entity.RolePermissionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {
    List<RolePermission> findByRoleRoleId(Long roleId);
    boolean existsByRoleRoleIdAndPermissionPermissionId(Long roleId, Long permissionId);

    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.role.roleId = :roleId AND rp.permission.permissionId = :permissionId")
    void deleteByRoleIdAndPermissionId(@Param("roleId") Long roleId, @Param("permissionId") Long permissionId);

    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.role.roleId = :roleId")
    void deleteAllByRoleId(@Param("roleId") Long roleId);
}
