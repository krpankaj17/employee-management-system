package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@Tag(name = "Authentication & RBAC", description = "User registration, authentication, password reset, roles and permission management")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/send-otp")
    @Operation(summary = "Sends a 6-digit email verification OTP to the specified email address")
    public ResponseEntity<SendOtpOut> sendOtp(@Valid @RequestBody SendOtpIn payload) {
        SendOtpOut result = authService.requestSignupOtp(payload);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/signup")
    @Operation(summary = "Self-service user registration with display_name, email, password, and the 6-digit email OTP")
    public ResponseEntity<TokenOut> signup(@Valid @RequestBody UserSignupIn payload) {
        TokenOut result = authService.signupUser(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticates user with email & password, returns JWT tokens and granted permissions")
    public ResponseEntity<TokenOut> login(@Valid @RequestBody UserLoginIn payload) {
        TokenOut result = authService.authenticateUser(payload);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Issues a new short-lived access token using a valid refresh token")
    public ResponseEntity<Map<String, Object>> refreshToken(@Valid @RequestBody TokenRefreshIn payload) {
        Map<String, Object> result = authService.refreshToken(payload.getRefreshToken());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me")
    @Operation(summary = "Returns profile, roles, permissions, and linked employee UUID for authenticated user")
    public ResponseEntity<UserProfileOut> getMyProfile(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        UserProfileOut profile = authService.getUserProfile(currentUser.getPublicId());
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Sends a 6-digit password reset verification OTP to the specified email address")
    public ResponseEntity<SendOtpOut> forgotPassword(@Valid @RequestBody ForgotPasswordIn payload) {
        SendOtpOut result = authService.requestPasswordReset(payload);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Validates 6-digit password reset OTP and updates the user's password")
    public ResponseEntity<Map<String, Object>> resetPassword(@Valid @RequestBody ResetPasswordIn payload) {
        Map<String, Object> result = authService.resetPassword(payload);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/change-password")
    @Operation(summary = "Updates password for currently authenticated user and revokes prior active sessions")
    public ResponseEntity<TokenOut> changePassword(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @Valid @RequestBody ChangePasswordIn payload
    ) {
        TokenOut result = authService.changePassword(currentUser.getPublicId(), payload);
        return ResponseEntity.ok(result);
    }



    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Lists all system roles and their assigned permissions")
    public ResponseEntity<List<RoleOut>> listRoles() {
        return ResponseEntity.ok(authService.listRoles());
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Creates a new custom role with optional permission assignments")
    public ResponseEntity<RoleOut> createRole(@Valid @RequestBody RoleCreateIn payload) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createRole(payload));
    }

    @GetMapping("/roles/{identifier}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Retrieves role details and active permissions by role name or public UUID")
    public ResponseEntity<RoleOut> getRole(@PathVariable("identifier") String identifier) {
        return ResponseEntity.ok(authService.getRole(identifier));
    }

    @PutMapping("/roles/{identifier}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Updates role details and permissions")
    public ResponseEntity<RoleOut> updateRole(
            @PathVariable("identifier") String identifier,
            @Valid @RequestBody RoleUpdateIn payload
    ) {
        return ResponseEntity.ok(authService.updateRole(identifier, payload));
    }

    @PostMapping("/roles/{identifier}/permissions")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Adds one or more permissions to an existing role")
    public ResponseEntity<RoleOut> addPermissionsToRole(
            @PathVariable("identifier") String identifier,
            @Valid @RequestBody RolePermissionsUpdateIn payload
    ) {
        return ResponseEntity.ok(authService.addPermissionsToRole(identifier, payload.getPermissionNames()));
    }

    @DeleteMapping("/roles/{identifier}/permissions/{permission_name}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Revokes a specific permission from a role")
    public ResponseEntity<RoleOut> revokePermissionFromRole(
            @PathVariable("identifier") String identifier,
            @PathVariable("permission_name") String permissionName
    ) {
        return ResponseEntity.ok(authService.revokePermissionFromRole(identifier, permissionName));
    }

    @DeleteMapping("/roles/{identifier}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes a custom role (built-in Admin role is protected)")
    public ResponseEntity<Map<String, String>> deleteRole(@PathVariable("identifier") String identifier) {
        authService.deleteRole(identifier);
        return ResponseEntity.ok(Map.of("message", "Role '" + identifier + "' deleted successfully"));
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Lists all 41 granular system permissions")
    public ResponseEntity<List<PermissionOut>> listPermissions() {
        return ResponseEntity.ok(authService.listPermissions());
    }

    @GetMapping("/pending-users")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Lists all users pending role assignment / admin approval")
    public ResponseEntity<List<UserProfileOut>> getPendingUsers(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(authService.listPendingUsers(skip, limit));
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Lists all registered users with their roles, permissions, and linked employee UUID")
    public ResponseEntity<List<UserProfileOut>> getAllUsers(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(authService.listUsers(skip, limit));
    }

    @GetMapping("/users/{public_id}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Retrieves user profile by public UUID or identifier")
    public ResponseEntity<UserProfileOut> getUserById(@PathVariable("public_id") String publicId) {
        return ResponseEntity.ok(authService.getUserProfileByIdentifier(publicId));
    }

    @PostMapping("/users/{public_id}/roles")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Assigns roles to a user and auto-provisions base employee profile if missing")
    public ResponseEntity<UserProfileOut> assignUserRoles(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody RoleAssignIn payload
    ) {
        UserProfileOut result = authService.assignRoles(UUID.fromString(publicId), payload.getRoleNames());
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/users/{public_id}/roles/{role_name}")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Revokes a specific role from a user")
    public ResponseEntity<UserProfileOut> revokeRoleFromUser(
            @PathVariable("public_id") String publicId,
            @PathVariable("role_name") String roleName
    ) {
        UserProfileOut result = authService.revokeRoleFromUser(UUID.fromString(publicId), roleName);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/users/{public_id}/access")
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Updates user roles, custom granted permissions, revoked permissions, and active status")
    public ResponseEntity<UserProfileOut> updateUserAccess(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody UserAccessUpdateIn payload
    ) {
        UserProfileOut result = authService.updateUserAccess(UUID.fromString(publicId), payload);
        return ResponseEntity.ok(result);
    }

    @RequestMapping(value = {"/users/{public_id}/reject", "/users/{public_id}"}, method = {RequestMethod.POST, RequestMethod.DELETE})
    @PreAuthorize("hasAuthority('role:manage') or hasRole('Admin') or hasRole('HR_Manager')")
    @Operation(summary = "Rejects a pending user registration and removes the unapproved user")
    public ResponseEntity<java.util.Map<String, Object>> rejectUser(@PathVariable("public_id") String publicId) {
        authService.rejectUser(UUID.fromString(publicId));
        java.util.Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("ok", true);
        resp.put("message", "User registration rejected and removed successfully.");
        return ResponseEntity.ok(resp);
    }

}
