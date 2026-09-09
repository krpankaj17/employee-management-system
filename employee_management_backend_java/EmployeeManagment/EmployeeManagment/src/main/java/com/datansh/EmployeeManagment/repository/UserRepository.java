package com.datansh.EmployeeManagment.repository;

import com.datansh.EmployeeManagment.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPublicId(UUID publicId);
    Optional<User> findByPasswordResetToken(String token);
    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u LEFT JOIN u.userRoles ur WHERE ur.id IS NULL")
    List<User> findPendingUsers();

    @Query("SELECT r.roleName FROM UserRole ur JOIN ur.role r WHERE ur.user.userId = :userId")
    List<String> findRoleNamesByUserId(@Param("userId") Long userId);

    @Query("SELECT DISTINCT p.permissionName FROM UserRole ur JOIN ur.role r JOIN r.rolePermissions rp JOIN rp.permission p WHERE ur.user.userId = :userId")
    List<String> findPermissionNamesByUserId(@Param("userId") Long userId);
}
