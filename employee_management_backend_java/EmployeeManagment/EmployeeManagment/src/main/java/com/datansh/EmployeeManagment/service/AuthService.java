package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.*;
import com.datansh.EmployeeManagment.security.JwtUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;


    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private EmailVerificationRepository emailVerificationRepository;

    @Autowired
    private EmailService emailService;

    private static final java.security.SecureRandom SECURE_RANDOM = new java.security.SecureRandom();

    public SendOtpOut requestSignupOtp(SendOtpIn payload) {
        String cleanEmail = payload.getEmail().trim().toLowerCase();

        // Check if user is already registered
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new BadRequestException("An account with email '" + cleanEmail + "' already exists. Please log in.");
        }

        OffsetDateTime now = OffsetDateTime.now();

        // Check existing unexpired cooldown
        Optional<EmailVerification> existingVerification = emailVerificationRepository.findFirstByEmailOrderByIdDesc(cleanEmail);
        if (existingVerification.isPresent()) {
            EmailVerification rec = existingVerification.get();
            if (rec.getResendAvailableAt() != null && rec.getResendAvailableAt().isAfter(now)) {
                long remainingSeconds = java.time.Duration.between(now, rec.getResendAvailableAt()).getSeconds();
                throw new BadRequestException("Please wait " + Math.max(remainingSeconds, 1) + " seconds before requesting a new verification code.");
            }
        }

        // Generate 6-digit OTP
        int codeInt = 100000 + SECURE_RANDOM.nextInt(900000);
        String otpCode = String.valueOf(codeInt);
        String otpHash = hashOtp(otpCode);

        int expiresInSeconds = 150;
        EmailVerification verificationRecord = EmailVerification.builder()
                .email(cleanEmail)
                .otpHash(otpHash)
                .expiresAt(now.plusSeconds(expiresInSeconds))
                .resendAvailableAt(now.plusSeconds(expiresInSeconds))
                .attempts(0L)
                .isVerified(false)
                .build();

        emailVerificationRepository.save(verificationRecord);

        // Send OTP email
        emailService.sendOtpEmail(cleanEmail, otpCode, expiresInSeconds);
        log.info("[AUTH] Verification OTP sent successfully to email: {}", cleanEmail);

        return SendOtpOut.builder()
                .ok(true)
                .message("A 6-digit verification code has been sent to " + cleanEmail + ".")
                .expiresInSeconds(expiresInSeconds)
                .resendInSeconds(expiresInSeconds)
                .build();
    }

    public TokenOut signupUser(UserSignupIn payload) {
        String cleanEmail = payload.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(cleanEmail)) {
            log.warn("[AUTH] Signup rejected - email already exists: {}", cleanEmail);
            throw new BadRequestException("User with email '" + cleanEmail + "' already exists");
        }

        OffsetDateTime now = OffsetDateTime.now();
        EmailVerification rec = emailVerificationRepository.findFirstByEmailOrderByIdDesc(cleanEmail)
                .orElseThrow(() -> new ResourceNotFoundException("No verification request found for this email. Please request an OTP code first."));

        // Check expiration
        if (now.isAfter(rec.getExpiresAt())) {
            log.warn("[AUTH] Signup rejected - OTP expired for email: {}", cleanEmail);
            throw new BadRequestException("The verification code has expired. Please request a new OTP code.");
        }

        // Check attempts
        if (rec.getAttempts() >= 3) {
            emailVerificationRepository.deleteAllByEmail(cleanEmail);
            log.warn("[AUTH] Signup rejected - too many invalid OTP attempts for email: {}", cleanEmail);
            throw new BadRequestException("Too many invalid attempts. This verification code has been invalidated. Please request a new one.");
        }

        // Verify OTP Hash
        String inputHash = hashOtp(payload.getOtp().trim());
        if (!inputHash.equals(rec.getOtpHash())) {
            rec.setAttempts(rec.getAttempts() + 1);
            emailVerificationRepository.save(rec);
            long remaining = 3 - rec.getAttempts();
            log.warn("[AUTH] Invalid OTP entered for email: {}, {} attempt(s) remaining", cleanEmail, remaining);
            if (remaining > 0) {
                throw new BadRequestException("Invalid verification code. " + remaining + " attempt(s) remaining.");
            } else {
                emailVerificationRepository.deleteAllByEmail(cleanEmail);
                throw new BadRequestException("Too many invalid attempts. This verification code has been invalidated. Please request a new one.");
            }
        }

        // OTP is valid! Create user
        User user = User.builder()
                .email(cleanEmail)
                .displayName(payload.getDisplayName().trim())
                .secondaryEmail(payload.getSecondaryEmail() != null ? payload.getSecondaryEmail().trim().toLowerCase() : null)
                .passwordHash(passwordEncoder.encode(payload.getPassword()))
                .isActive(true)
                .build();

        user = userRepository.save(user);
        log.info("[AUTH] User registered successfully: userId={}, publicId={}, email={}", user.getUserId(), user.getPublicId(), cleanEmail);

        // Clean up verification records for this email
        emailVerificationRepository.deleteAllByEmail(cleanEmail);

        // User registers without roles initially, awaiting admin approval and role assignment.
        // Once approved, the admin assigns roles and the employee record is automatically provisioned.
        log.info("[AUTH] User registered awaiting admin role approval: userId={}, publicId={}, email={}", user.getUserId(), user.getPublicId(), cleanEmail);

        return createTokenResponse(user);
    }

    private String hashOtp(String otp) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(otp.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : digest) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    public TokenOut authenticateUser(UserLoginIn payload) {
        String cleanEmail = payload.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> {
                    log.warn("[AUTH] Login failed - user not found: {}", cleanEmail);
                    return new BadRequestException("Invalid email or password");
                });

        if (!passwordEncoder.matches(payload.getPassword(), user.getPasswordHash())) {
            log.warn("[AUTH] Login failed - invalid password for email: {}", cleanEmail);
            throw new BadRequestException("Invalid email or password");
        }

        if (user.getIsActive() != null && !user.getIsActive()) {
            log.warn("[AUTH] Login rejected - account deactivated: {}", cleanEmail);
            throw new ForbiddenException("Your user account is currently deactivated");
        }

        user.setLastLogin(OffsetDateTime.now());
        userRepository.save(user);
        log.info("[AUTH] User authenticated successfully: userId={}, publicId={}, email={}", user.getUserId(), user.getPublicId(), cleanEmail);

        return createTokenResponse(user);
    }

    public Map<String, Object> refreshToken(String refreshToken) {
        if (!jwtUtils.validateToken(refreshToken)) {
            log.warn("[AUTH] Token refresh failed - invalid or expired refresh token");
            throw new BadRequestException("Invalid or expired refresh token");
        }

        String tokenType = jwtUtils.getTokenType(refreshToken);
        if (!"refresh".equalsIgnoreCase(tokenType)) {
            log.warn("[AUTH] Token refresh failed - non-refresh token passed: {}", tokenType);
            throw new BadRequestException("Invalid token type: refresh token required");
        }

        String publicIdStr = jwtUtils.getPublicIdFromToken(refreshToken);
        UUID publicId = UUID.fromString(publicIdStr);

        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getIsActive() != null && !user.getIsActive()) {
            log.warn("[AUTH] Token refresh rejected - account deactivated for user: {}", publicId);
            throw new ForbiddenException("Account is deactivated");
        }

        // Validate token version against current user state (session revocation check)
        Integer tokenVer = jwtUtils.getTokenVersion(refreshToken);
        int currentVer = user.getTokenVersion() != null ? user.getTokenVersion() : 1;
        if (tokenVer != null && tokenVer != currentVer) {
            log.warn("[AUTH] Token refresh rejected - token version mismatch (session revoked): tokenVer={}, currentVer={}", tokenVer, currentVer);
            throw new ForbiddenException("Your session has expired or was revoked due to a password change. Please log in again.");
        }

        String newAccessToken = jwtUtils.generateAccessToken(user.getPublicId(), user.getEmail(), user.getTokenVersion());
        String newRefreshToken = jwtUtils.generateRefreshToken(user.getPublicId(), user.getEmail(), user.getTokenVersion());
        log.info("[AUTH] Access token and refresh token refreshed successfully for user: userId={}, email={}", user.getUserId(), user.getEmail());

        Map<String, Object> response = new HashMap<>();
        response.put("access_token", newAccessToken);
        response.put("accessToken", newAccessToken);
        response.put("refresh_token", newRefreshToken);
        response.put("refreshToken", newRefreshToken);
        response.put("token_type", "bearer");
        response.put("expires_in", 3600);
        return response;
    }

    @Transactional(readOnly = true)
    public UserProfileOut getUserProfile(UUID publicId) {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("User with public_id '" + publicId + "' not found"));
        return mapToUserProfile(user);
    }

    public SendOtpOut requestPasswordReset(ForgotPasswordIn payload) {
        String cleanEmail = payload.getEmail().trim().toLowerCase();

        // Account Enumeration Defense: If user does not exist, return generic success without leaking existence
        Optional<User> userOpt = userRepository.findByEmail(cleanEmail);
        if (userOpt.isEmpty()) {
            log.info("[AUTH] Password reset requested for non-existent email (enumeration-safe): {}", cleanEmail);
            return SendOtpOut.builder()
                    .ok(true)
                    .message("If an account with this email exists, a 6-digit password reset verification code has been sent.")
                    .expiresInSeconds(150)
                    .resendInSeconds(150)
                    .build();
        }

        OffsetDateTime now = OffsetDateTime.now();

        // Check existing unexpired cooldown
        Optional<EmailVerification> existingVerification = emailVerificationRepository.findFirstByEmailOrderByIdDesc(cleanEmail);
        if (existingVerification.isPresent()) {
            EmailVerification rec = existingVerification.get();
            if (rec.getResendAvailableAt() != null && rec.getResendAvailableAt().isAfter(now)) {
                long remainingSeconds = java.time.Duration.between(now, rec.getResendAvailableAt()).getSeconds();
                throw new BadRequestException("Please wait " + Math.max(remainingSeconds, 1) + " seconds before requesting a new password reset code.");
            }
        }

        // Generate 6-digit OTP
        int codeInt = 100000 + SECURE_RANDOM.nextInt(900000);
        String otpCode = String.valueOf(codeInt);
        String otpHash = hashOtp(otpCode);

        int expiresInSeconds = 150;

        // Delete previous verification records for this email
        emailVerificationRepository.deleteAllByEmail(cleanEmail);

        EmailVerification verificationRecord = EmailVerification.builder()
                .email(cleanEmail)
                .otpHash(otpHash)
                .expiresAt(now.plusSeconds(expiresInSeconds))
                .resendAvailableAt(now.plusSeconds(expiresInSeconds))
                .attempts(0L)
                .isVerified(false)
                .build();

        emailVerificationRepository.save(verificationRecord);

        // Send OTP email
        emailService.sendPasswordResetOtpEmail(cleanEmail, otpCode, expiresInSeconds);
        log.info("[AUTH] Password reset OTP sent successfully to email: {}", cleanEmail);

        return SendOtpOut.builder()
                .ok(true)
                .message("If an account with this email exists, a 6-digit password reset verification code has been sent.")
                .expiresInSeconds(expiresInSeconds)
                .resendInSeconds(expiresInSeconds)
                .build();
    }

    public Map<String, Object> resetPassword(ResetPasswordIn payload) {
        String cleanEmail = payload.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> {
                    log.warn("[AUTH] Password reset failed - user not found: {}", cleanEmail);
                    return new BadRequestException("Invalid verification code or email");
                });

        OffsetDateTime now = OffsetDateTime.now();
        EmailVerification rec = emailVerificationRepository.findFirstByEmailOrderByIdDesc(cleanEmail)
                .orElseThrow(() -> new BadRequestException("Invalid or expired verification code. Please request a new OTP."));

        // Check expiration
        if (now.isAfter(rec.getExpiresAt())) {
            log.warn("[AUTH] Password reset rejected - OTP expired for email: {}", cleanEmail);
            throw new BadRequestException("The verification code has expired. Please request a new OTP code.");
        }

        // Check attempts
        if (rec.getAttempts() >= 3) {
            emailVerificationRepository.deleteAllByEmail(cleanEmail);
            log.warn("[AUTH] Password reset rejected - too many invalid OTP attempts for email: {}", cleanEmail);
            throw new BadRequestException("Too many invalid attempts. This verification code has been invalidated. Please request a new one.");
        }

        // Verify OTP Hash
        String inputHash = hashOtp(payload.getOtp().trim());
        if (!inputHash.equals(rec.getOtpHash())) {
            rec.setAttempts(rec.getAttempts() + 1);
            emailVerificationRepository.save(rec);
            long remaining = 3 - rec.getAttempts();
            log.warn("[AUTH] Invalid password reset OTP entered for email: {}, {} attempt(s) remaining", cleanEmail, remaining);
            if (remaining > 0) {
                throw new BadRequestException("Invalid verification code. " + remaining + " attempt(s) remaining.");
            } else {
                emailVerificationRepository.deleteAllByEmail(cleanEmail);
                throw new BadRequestException("Too many invalid attempts. This verification code has been invalidated. Please request a new one.");
            }
        }

        // OTP is valid! Update password and increment token_version (invalidating all prior sessions)
        user.setPasswordHash(passwordEncoder.encode(payload.getNewPassword()));
        user.setTokenVersion((user.getTokenVersion() != null ? user.getTokenVersion() : 1) + 1);
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiresAt(null);
        user.setPasswordResetUsedAt(OffsetDateTime.now());
        userRepository.save(user);

        // Clean up verification records for this email
        emailVerificationRepository.deleteAllByEmail(cleanEmail);

        // Dispatch security notification email
        emailService.sendPasswordChangedAlertEmail(cleanEmail);
        log.info("[AUTH] Password reset completed and sessions revoked for user: userId={}, email={}", user.getUserId(), user.getEmail());

        Map<String, Object> res = new HashMap<>();
        res.put("ok", true);
        res.put("message", "Password has been successfully updated. All prior active sessions have been revoked.");
        return res;
    }

    public TokenOut changePassword(UUID userPublicId, ChangePasswordIn payload) {
        User user = userRepository.findByPublicId(userPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(payload.getCurrentPassword(), user.getPasswordHash())) {
            log.warn("[AUTH] Password change rejected - incorrect current password for user: {}", user.getEmail());
            throw new BadRequestException("Current password does not match");
        }

        if (passwordEncoder.matches(payload.getNewPassword(), user.getPasswordHash())) {
            throw new BadRequestException("New password cannot be the same as the current password");
        }

        // Update password and increment token_version (invalidating prior sessions on other devices)
        user.setPasswordHash(passwordEncoder.encode(payload.getNewPassword()));
        user.setTokenVersion((user.getTokenVersion() != null ? user.getTokenVersion() : 1) + 1);
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);

        // Send security notification alert
        emailService.sendPasswordChangedAlertEmail(user.getEmail());
        log.info("[AUTH] In-app password change successful and sessions revoked for user: userId={}, email={}", user.getUserId(), user.getEmail());

        return createTokenResponse(user);
    }



    @Transactional(readOnly = true)
    public List<RoleOut> listRoles() {
        return roleRepository.findAll().stream().map(this::mapToRoleOut).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public RoleOut getRole(String identifier) {
        Role role = findRoleByIdentifier(identifier);
        return mapToRoleOut(role);
    }

    public RoleOut createRole(RoleCreateIn payload) {
        String cleanName = payload.getRoleName().trim();
        if (roleRepository.existsByRoleName(cleanName)) {
            throw new BadRequestException("Role with name '" + cleanName + "' already exists");
        }

        Role role = Role.builder()
                .roleName(cleanName)
                .description(payload.getDescription() != null ? payload.getDescription().trim() : null)
                .build();
        role = roleRepository.save(role);

        if (payload.getPermissionNames() != null && !payload.getPermissionNames().isEmpty()) {
            for (String permName : payload.getPermissionNames()) {
                Optional<Permission> pOpt = permissionRepository.findByPermissionName(permName.trim());
                if (pOpt.isPresent()) {
                    Permission perm = pOpt.get();
                    RolePermission rp = RolePermission.builder()
                            .id(new RolePermissionId(role.getRoleId(), perm.getPermissionId()))
                            .role(role)
                            .permission(perm)
                            .build();
                    rolePermissionRepository.save(rp);
                }
            }
        }
        log.info("[AUTH] Created new role '{}' with permissions: {}", cleanName, payload.getPermissionNames());
        return mapToRoleOut(roleRepository.findById(role.getRoleId()).orElse(role));
    }

    public RoleOut updateRole(String identifier, RoleUpdateIn payload) {
        Role role = findRoleByIdentifier(identifier);

        if (payload.getRoleName() != null && !payload.getRoleName().trim().isEmpty()) {
            String newName = payload.getRoleName().trim();
            if ("Admin".equalsIgnoreCase(role.getRoleName()) && !role.getRoleName().equalsIgnoreCase(newName)) {
                throw new BadRequestException("The primary 'Admin' role name cannot be renamed");
            }
            if (!role.getRoleName().equalsIgnoreCase(newName) && roleRepository.existsByRoleName(newName)) {
                throw new BadRequestException("Role with name '" + newName + "' already exists");
            }
            role.setRoleName(newName);
        }

        if (payload.getDescription() != null) {
            role.setDescription(payload.getDescription().trim());
        }
        roleRepository.save(role);

        if (payload.getPermissionNames() != null) {
            rolePermissionRepository.deleteAllByRoleId(role.getRoleId());
            for (String permName : payload.getPermissionNames()) {
                Optional<Permission> pOpt = permissionRepository.findByPermissionName(permName.trim());
                if (pOpt.isPresent()) {
                    Permission perm = pOpt.get();
                    RolePermission rp = RolePermission.builder()
                            .id(new RolePermissionId(role.getRoleId(), perm.getPermissionId()))
                            .role(role)
                            .permission(perm)
                            .build();
                    rolePermissionRepository.save(rp);
                }
            }
        }
        log.info("[AUTH] Updated role '{}'", role.getRoleName());
        return mapToRoleOut(roleRepository.findById(role.getRoleId()).orElse(role));
    }

    public RoleOut addPermissionsToRole(String identifier, List<String> permissionNames) {
        Role role = findRoleByIdentifier(identifier);
        for (String permName : permissionNames) {
            Optional<Permission> pOpt = permissionRepository.findByPermissionName(permName.trim());
            if (pOpt.isPresent()) {
                Permission perm = pOpt.get();
                if (!rolePermissionRepository.existsByRoleRoleIdAndPermissionPermissionId(role.getRoleId(), perm.getPermissionId())) {
                    RolePermission rp = RolePermission.builder()
                            .id(new RolePermissionId(role.getRoleId(), perm.getPermissionId()))
                            .role(role)
                            .permission(perm)
                            .build();
                    rolePermissionRepository.save(rp);
                }
            } else {
                throw new BadRequestException("Permission '" + permName + "' does not exist");
            }
        }
        log.info("[AUTH] Added permissions {} to role '{}'", permissionNames, role.getRoleName());
        return mapToRoleOut(roleRepository.findById(role.getRoleId()).orElse(role));
    }

    public RoleOut revokePermissionFromRole(String identifier, String permissionName) {
        Role role = findRoleByIdentifier(identifier);
        if ("Admin".equalsIgnoreCase(role.getRoleName()) && "role:manage".equalsIgnoreCase(permissionName.trim())) {
            throw new BadRequestException("Cannot revoke 'role:manage' permission from 'Admin' role");
        }

        Permission perm = permissionRepository.findByPermissionName(permissionName.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Permission '" + permissionName + "' not found"));

        rolePermissionRepository.deleteByRoleIdAndPermissionId(role.getRoleId(), perm.getPermissionId());
        log.info("[AUTH] Revoked permission '{}' from role '{}'", permissionName, role.getRoleName());
        return mapToRoleOut(roleRepository.findById(role.getRoleId()).orElse(role));
    }

    public void deleteRole(String identifier) {
        Role role = findRoleByIdentifier(identifier);
        if ("Admin".equalsIgnoreCase(role.getRoleName())) {
            throw new BadRequestException("The primary 'Admin' role is protected and cannot be deleted");
        }
        rolePermissionRepository.deleteAllByRoleId(role.getRoleId());
        roleRepository.delete(role);
        log.info("[AUTH] Deleted custom role '{}'", role.getRoleName());
    }

    public UserProfileOut revokeRoleFromUser(UUID userPublicId, String roleName) {
        User user = userRepository.findByPublicId(userPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("User with public_id '" + userPublicId + "' not found"));

        Role role = roleRepository.findByRoleName(roleName.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Role '" + roleName + "' not found"));

        if (user.getUserRoles() != null) {
            user.getUserRoles().removeIf(ur -> ur.getRole().getRoleId().equals(role.getRoleId()));
            userRepository.save(user);
        }
        log.info("[AUTH] Revoked role '{}' from user: userId={}, publicId={}", roleName, user.getUserId(), user.getPublicId());
        return mapToUserProfile(user);
    }

    private Role findRoleByIdentifier(String identifier) {
        try {
            UUID uuid = UUID.fromString(identifier);
            return roleRepository.findByPublicId(uuid)
                    .or(() -> roleRepository.findByRoleName(identifier))
                    .orElseThrow(() -> new ResourceNotFoundException("Role with identifier '" + identifier + "' not found"));
        } catch (IllegalArgumentException e) {
            return roleRepository.findByRoleName(identifier)
                    .orElseThrow(() -> new ResourceNotFoundException("Role with name '" + identifier + "' not found"));
        }
    }

    private RoleOut mapToRoleOut(Role r) {
        List<String> permNames = rolePermissionRepository.findByRoleRoleId(r.getRoleId())
                .stream()
                .map(rp -> rp.getPermission().getPermissionName())
                .collect(Collectors.toList());

        return RoleOut.builder()
                .publicId(r.getPublicId() != null ? r.getPublicId().toString() : null)
                .roleName(r.getRoleName())
                .description(r.getDescription())
                .permissions(permNames)
                .build();
    }


    @Transactional(readOnly = true)
    public List<PermissionOut> listPermissions() {
        return permissionRepository.findAll().stream().map(p -> PermissionOut.builder()
                .publicId(p.getPublicId().toString())
                .permissionName(p.getPermissionName())
                .description(p.getDescription())
                .build()
        ).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserProfileOut> listUsers(int skip, Integer limit) {
        List<User> users = userRepository.findAll();
        return users.stream()
                .skip(skip)
                .limit(limit != null ? limit : users.size())
                .map(this::mapToUserProfile)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserProfileOut> listPendingUsers(int skip, Integer limit) {
        List<User> users = userRepository.findPendingUsers();
        return users.stream()
                .skip(skip)
                .limit(limit != null ? limit : users.size())
                .map(this::mapToUserProfile)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserProfileOut getUserProfileByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new ResourceNotFoundException("User identifier cannot be empty");
        }
        try {
            UUID uuid = UUID.fromString(identifier.trim());
            return userRepository.findByPublicId(uuid)
                    .map(this::mapToUserProfile)
                    .orElseGet(() -> userRepository.findByEmail(identifier.trim().toLowerCase())
                            .map(this::mapToUserProfile)
                            .orElseThrow(() -> new ResourceNotFoundException("User with identifier '" + identifier + "' not found")));
        } catch (IllegalArgumentException e) {
            return userRepository.findByEmail(identifier.trim().toLowerCase())
                    .map(this::mapToUserProfile)
                    .orElseThrow(() -> new ResourceNotFoundException("User with identifier '" + identifier + "' not found"));
        }
    }

    public UserProfileOut assignRoles(UUID userPublicId, List<String> roleNames) {
        User user = userRepository.findByPublicId(userPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("User with public_id '" + userPublicId + "' not found"));

        Set<UserRole> currentRoles = user.getUserRoles();
        if (currentRoles == null) {
            currentRoles = new HashSet<>();
            user.setUserRoles(currentRoles);
        }

        // Map target roles
        Set<Role> targetRoles = new HashSet<>();
        for (String roleName : roleNames) {
            Role role = roleRepository.findByRoleName(roleName)
                    .orElseThrow(() -> new BadRequestException("Role '" + roleName + "' does not exist"));
            targetRoles.add(role);
        }

        // 1. Remove roles that are no longer assigned (orphanRemoval=true triggers delete on flush)
        currentRoles.removeIf(ur -> !targetRoles.contains(ur.getRole()));

        // 2. Add new roles that are not yet in the set
        Set<Long> existingRoleIds = currentRoles.stream()
                .map(ur -> ur.getRole().getRoleId())
                .collect(Collectors.toSet());

        for (Role role : targetRoles) {
            if (!existingRoleIds.contains(role.getRoleId())) {
                UserRole ur = UserRole.builder()
                        .id(new UserRoleId(user.getUserId(), role.getRoleId()))
                        .user(user)
                        .role(role)
                        .assignedAt(OffsetDateTime.now())
                        .build();
                currentRoles.add(ur);
            }
        }

        userRepository.save(user);
        log.info("[AUTH] Assigned roles {} to user: userId={}, publicId={}", roleNames, user.getUserId(), user.getPublicId());

        // Auto-provision base employee profile if missing
        Optional<Employee> empOpt = employeeRepository.findByUserUserId(user.getUserId());
        if (empOpt.isEmpty()) {
            String[] nameParts = user.getDisplayName().split(" ", 2);
            String firstName = nameParts[0];
            String lastName = nameParts.length > 1 ? nameParts[1] : firstName;
            String employeeCode = generateEmployeeCode();

            Employee employee = Employee.builder()
                    .user(user)
                    .employeeCode(employeeCode)
                    .firstName(firstName)
                    .lastName(lastName)
                    .email(user.getEmail())
                    .employeeStatus("active")
                    .employmentType("full_time")
                    .isActive(true)
                    .timezone("UTC")
                    .build();
            employeeRepository.save(employee);
            user.setEmployee(employee);
        }

        return mapToUserProfile(user);
    }

    public void rejectUser(UUID publicId) {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("User with public ID '" + publicId + "' not found"));

        if (user.hasRole("Admin")) {
            throw new BadRequestException("Cannot reject or remove an Administrator account");
        }

        log.info("[AUTH] Rejecting unapproved user registration: userId={}, publicId={}, email={}", user.getUserId(), publicId, user.getEmail());

        Optional<Employee> empOpt = employeeRepository.findByUserUserId(user.getUserId());
        empOpt.ifPresent(employee -> employeeRepository.delete(employee));

        userRepository.delete(user);
    }

    private String generateEmployeeCode() {
        long count = employeeRepository.count() + 1;
        String code = String.format("EMP-%04d", count);
        while (employeeRepository.existsByEmployeeCode(code)) {
            count++;
            code = String.format("EMP-%04d", count);
        }
        return code;
    }

    private TokenOut createTokenResponse(User user) {
        String accessToken = jwtUtils.generateAccessToken(user.getPublicId(), user.getEmail(), user.getTokenVersion());
        String refreshToken = jwtUtils.generateRefreshToken(user.getPublicId(), user.getEmail(), user.getTokenVersion());

        List<String> permissions = userRepository.findPermissionNamesByUserId(user.getUserId());

        UserProfileOut profile = mapToUserProfile(user);

        return TokenOut.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("bearer")
                .expiresIn(3600L)
                .user(profile)
                .permissions(permissions)
                .build();
    }

    public UserProfileOut updateUserAccess(UUID publicId, UserAccessUpdateIn payload) {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("User with public_id '" + publicId + "' not found"));

        if (payload.getRoles() != null) {
            assignRoles(publicId, payload.getRoles());
            user = userRepository.findByPublicId(publicId).orElse(user);
        }

        if (payload.getCustomPermissions() != null) {
            try {
                user.setCustomPermissions(com.datansh.EmployeeManagment.util.JsonUtil.toJson(payload.getCustomPermissions()));
            } catch (Exception e) {
                user.setCustomPermissions("[]");
            }
        }

        if (payload.getRevokedPermissions() != null) {
            try {
                user.setRevokedPermissions(com.datansh.EmployeeManagment.util.JsonUtil.toJson(payload.getRevokedPermissions()));
            } catch (Exception e) {
                user.setRevokedPermissions("[]");
            }
        }

        if (payload.getIsActive() != null) {
            user.setIsActive(payload.getIsActive());
            if (Boolean.FALSE.equals(payload.getIsActive())) {
                user.setTokenVersion(user.getTokenVersion() + 1);
            }
            Optional<Employee> empOpt = employeeRepository.findByUserUserId(user.getUserId());
            if (empOpt.isPresent()) {
                Employee emp = empOpt.get();
                emp.setIsActive(payload.getIsActive());
                if (Boolean.FALSE.equals(payload.getIsActive())) {
                    emp.setEmployeeStatus("inactive");
                } else if ("inactive".equalsIgnoreCase(emp.getEmployeeStatus()) || "suspended".equalsIgnoreCase(emp.getEmployeeStatus())) {
                    emp.setEmployeeStatus("active");
                }
                employeeRepository.save(emp);
            }
        }

        user = userRepository.save(user);
        return mapToUserProfile(user);
    }

    public UserProfileOut mapToUserProfile(User user) {
        List<String> roles = userRepository.findRoleNamesByUserId(user.getUserId());
        List<String> permissions = new ArrayList<>(userRepository.findPermissionNamesByUserId(user.getUserId()));

        List<String> custom = user.getCustomPermissionsList();
        List<String> revoked = user.getRevokedPermissionsList();

        for (String cp : custom) {
            if (!permissions.contains(cp)) permissions.add(cp);
        }
        permissions.removeAll(revoked);

        String employeePublicId = null;
        if (user.getEmployee() != null && user.getEmployee().getPublicId() != null) {
            employeePublicId = user.getEmployee().getPublicId().toString();
        } else {
            Optional<Employee> empOpt = employeeRepository.findByUserUserId(user.getUserId());
            if (empOpt.isPresent()) {
                employeePublicId = empOpt.get().getPublicId().toString();
            }
        }

        return UserProfileOut.builder()
                .publicId(user.getPublicId().toString())
                .email(user.getEmail())
                .displayName(user.getDisplayName())
                .secondaryEmail(user.getSecondaryEmail())
                .isActive(user.getIsActive())
                .employeePublicId(employeePublicId)
                .lastLogin(user.getLastLogin() != null ? user.getLastLogin().toString() : null)
                .roles(roles)
                .permissions(permissions)
                .customPermissions(custom)
                .revokedPermissions(revoked)
                .build();
    }
}
