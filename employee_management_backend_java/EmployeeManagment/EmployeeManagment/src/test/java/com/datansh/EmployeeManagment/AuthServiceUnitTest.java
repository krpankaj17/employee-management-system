package com.datansh.EmployeeManagment;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.EmailVerification;
import com.datansh.EmployeeManagment.entity.User;
import com.datansh.EmployeeManagment.repository.EmailVerificationRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.repository.RoleRepository;
import com.datansh.EmployeeManagment.repository.UserRepository;
import com.datansh.EmployeeManagment.repository.UserRoleRepository;
import com.datansh.EmployeeManagment.security.JwtUtils;
import com.datansh.EmployeeManagment.service.AuthService;
import com.datansh.EmployeeManagment.service.EmailService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthServiceUnitTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private EmailVerificationRepository emailVerificationRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtils jwtUtils;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("Should authenticate user with valid credentials")
    void testAuthenticateUser() {
        UUID publicId = UUID.randomUUID();
        User mockUser = User.builder()
                .userId(1L)
                .publicId(publicId)
                .email("test@datansh.com")
                .displayName("Test User")
                .passwordHash("encoded_hash")
                .isActive(true)
                .build();

        when(userRepository.findByEmail("test@datansh.com")).thenReturn(Optional.of(mockUser));
        when(passwordEncoder.matches("password123", "encoded_hash")).thenReturn(true);
        when(jwtUtils.generateAccessToken(any(), any(), any())).thenReturn("mock_access_token");
        when(jwtUtils.generateRefreshToken(any(), any(), any())).thenReturn("mock_refresh_token");
        when(userRepository.findRoleNamesByUserId(1L)).thenReturn(List.of("Employee"));
        when(userRepository.findPermissionNamesByUserId(1L)).thenReturn(List.of("employee:read", "attendance:create"));

        UserLoginIn loginPayload = UserLoginIn.builder()
                .email("test@datansh.com")
                .password("password123")
                .build();

        TokenOut response = authService.authenticateUser(loginPayload);

        assertNotNull(response);
        assertEquals("mock_access_token", response.getAccessToken());
        assertEquals("mock_refresh_token", response.getRefreshToken());
        assertEquals("bearer", response.getTokenType());
        assertEquals("test@datansh.com", response.getUser().getEmail());
        assertTrue(response.getPermissions().contains("employee:read"));
    }

    @Test
    @DisplayName("Should request signup OTP successfully")
    void testRequestSignupOtp() {
        when(userRepository.existsByEmail("newuser@datansh.com")).thenReturn(false);
        when(emailVerificationRepository.findFirstByEmailOrderByIdDesc("newuser@datansh.com")).thenReturn(Optional.empty());

        SendOtpIn payload = SendOtpIn.builder().email("newuser@datansh.com").build();
        SendOtpOut result = authService.requestSignupOtp(payload);

        assertNotNull(result);
        assertTrue(result.getOk());
        assertEquals(150, result.getExpiresInSeconds());
        verify(emailVerificationRepository, times(1)).save(any());
        verify(emailService, times(1)).sendOtpEmail(eq("newuser@datansh.com"), anyString(), eq(150));
    }

    @Test
    @DisplayName("Should signup user with valid OTP")
    void testSignupUserWithValidOtp() throws Exception {
        String rawOtp = "123456";
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(rawOtp.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        StringBuilder hexString = new StringBuilder();
        for (byte b : digest) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        String otpHash = hexString.toString();

        EmailVerification mockVerification = EmailVerification.builder()
                .id(1L)
                .email("newuser@datansh.com")
                .otpHash(otpHash)
                .expiresAt(OffsetDateTime.now().plusMinutes(2))
                .resendAvailableAt(OffsetDateTime.now().plusMinutes(2))
                .attempts(0L)
                .build();

        when(userRepository.existsByEmail("newuser@datansh.com")).thenReturn(false);
        when(emailVerificationRepository.findFirstByEmailOrderByIdDesc("newuser@datansh.com")).thenReturn(Optional.of(mockVerification));
        when(passwordEncoder.encode("secretPassword123")).thenReturn("hashed_secret");

        UUID publicId = UUID.randomUUID();
        User savedUser = User.builder()
                .userId(2L)
                .publicId(publicId)
                .email("newuser@datansh.com")
                .displayName("New User")
                .passwordHash("hashed_secret")
                .isActive(true)
                .userRoles(new java.util.HashSet<>())
                .build();

        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(roleRepository.findByRoleName("Employee")).thenReturn(Optional.empty());
        when(jwtUtils.generateAccessToken(any(), any(), any())).thenReturn("access_token_xyz");
        when(jwtUtils.generateRefreshToken(any(), any(), any())).thenReturn("refresh_token_xyz");

        UserSignupIn signupPayload = UserSignupIn.builder()
                .displayName("New User")
                .email("newuser@datansh.com")
                .password("secretPassword123")
                .otp("123456")
                .build();

        TokenOut response = authService.signupUser(signupPayload);

        assertNotNull(response);
        assertEquals("access_token_xyz", response.getAccessToken());
        assertEquals("newuser@datansh.com", response.getUser().getEmail());
        verify(emailVerificationRepository, times(1)).deleteAllByEmail("newuser@datansh.com");
    }
}
