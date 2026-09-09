package com.datansh.EmployeeManagment.config;

import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;

import java.security.Principal;
import java.util.List;

@Configuration
public class OpenApiConfig {

    static {
        SpringDocUtils.getConfig()
                .addAnnotationsToIgnore(AuthenticationPrincipal.class)
                .addRequestWrapperToIgnore(
                        UserDetailsImpl.class,
                        UserDetails.class,
                        Principal.class,
                        Authentication.class
                );
    }

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        List<Tag> orderedTags = List.of(
                new Tag().name("Authentication & RBAC").description("User registration, authentication, password reset, roles and permission management"),
                new Tag().name("Employee Management").description("Employee directory search, profile lifecycle, addresses and emergency contacts"),
                new Tag().name("Department Management").description("Department hierarchy, codes, and department heads"),
                new Tag().name("Designation Management").description("Job titles and grade levels"),
                new Tag().name("Attendance Management").description("Live punch in/out, shift time tracking, manual records and attendance analytics"),
                new Tag().name("Holiday Calendar").description("Company and regional holiday calendar management"),
                new Tag().name("Leave Management").description("Leave balance tracking, leave requests, and multi-tier approval workflow"),
                new Tag().name("Compensation & Salaries").description("Salary revision history and itemized earnings/deductions structure"),
                new Tag().name("Bank Details").description("Employee bank account details for payroll disbursement"),
                new Tag().name("Payroll Management").description("Monthly payroll run batch generation, payslip generation, and disbursement confirmation"),
                new Tag().name("Project Management").description("Company projects and team assignments"),
                new Tag().name("Performance Reviews").description("Periodic performance evaluations and feedback"),
                new Tag().name("Document Management").description("Document records and links (Aadhaar, PAN, Passport, Resume, Offer Letters)"),
                new Tag().name("Announcements & Notifications").description("Company bulletins and real-time user inbox notifications"),
                new Tag().name("Audit Trail & Compliance").description("System activity and modification trails"),
                new Tag().name("default").description("Default root endpoints"),
                new Tag().name("System").description("Health and system status endpoints")
        );

        return new OpenAPI()
                .info(new Info()
                        .title("Employee Management System API (Spring Boot)")
                        .version("2.0.0")
                        .description("Enterprise REST API for Employees, RBAC Authentication, Departments, Attendance, Leaves, Payroll, Projects, Reviews, Documents & Announcements."))
                .tags(orderedTags)
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }

    @Bean
    public OpenApiCustomizer sortOpenApi() {
        return openApi -> {
            // ── 1. Re-order Tags explicitly (ensures Authentication & RBAC is always at the top) ──
            List<String> preferredTagOrder = List.of(
                    "Authentication & RBAC",
                    "Employee Management",
                    "Department Management",
                    "Designation Management",
                    "Attendance Management",
                    "Holiday Calendar",
                    "Leave Management",
                    "Compensation & Salaries",
                    "Bank Details",
                    "Payroll Management",
                    "Project Management",
                    "Performance Reviews",
                    "Document Management",
                    "Announcements & Notifications",
                    "Audit Trail & Compliance",
                    "default",
                    "System"
            );

            if (openApi.getTags() != null) {
                java.util.Map<String, Tag> tagMap = new java.util.LinkedHashMap<>();
                for (Tag tag : openApi.getTags()) {
                    tagMap.put(tag.getName(), tag);
                }
                java.util.List<Tag> sortedTags = new java.util.ArrayList<>();
                for (String tagName : preferredTagOrder) {
                    if (tagMap.containsKey(tagName)) {
                        sortedTags.add(tagMap.get(tagName));
                    }
                }
                for (Tag tag : openApi.getTags()) {
                    if (!sortedTags.contains(tag)) {
                        sortedTags.add(tag);
                    }
                }
                openApi.setTags(sortedTags);
            }

            // ── 2. Re-order Paths explicitly ──
            if (openApi.getPaths() != null) {
                Paths sortedPaths = new Paths();
                List<String> preferredOrder = List.of(
                        // ── Authentication & RBAC ──────────────────────────────
                        "/auth/send-otp",
                        "/auth/signup",
                        "/auth/login",
                        "/auth/refresh",
                        "/auth/me",
                        "/auth/forgot-password",
                        "/auth/reset-password",
                        "/auth/change-password",
                        "/auth/roles",

                        "/auth/roles/{identifier}",
                        "/auth/roles/{identifier}/permissions",
                        "/auth/roles/{identifier}/permissions/{permission_name}",
                        "/auth/permissions",
                        "/auth/pending-users",
                        "/auth/users",
                        "/auth/users/{public_id}",
                        "/auth/users/{public_id}/roles",
                        "/auth/users/{public_id}/roles/{role_name}",

                        // ── Employee Management ────────────────────────────────
                        "/employees/search",
                        "/employees/me",
                        "/employees/{public_id}/admin-setup",
                        "/employees/{public_id}",
                        "/employees/{public_id}/addresses",
                        "/employees/{public_id}/addresses/{address_public_id}",
                        "/employees/{public_id}/emergency-contacts",
                        "/employees/{public_id}/emergency-contacts/{contact_id}",
                        // ── Department Management ──────────────────────────────
                        "/departments",
                        "/departments/me",
                        "/departments/me/employees",
                        "/departments/{public_id}",
                        "/departments/{public_id}/employees",
                        // ── Designation Management ─────────────────────────────
                        "/designations",
                        "/designations/{public_id}",
                        // ── Attendance Management ──────────────────────────────
                        "/attendance/check-in",
                        "/attendance/check-out",
                        "/attendance/records",
                        "/attendance/records/{attendance_id}",
                        // ── Holiday Calendar ───────────────────────────────────
                        "/holidays",
                        "/holidays/{public_id}",
                        // ── Leave Management ───────────────────────────────────
                        "/leaves/types",
                        "/leaves/types/{public_id}",
                        "/leaves/balances/me",
                        "/leaves/balances/{employee_public_id}",
                        "/leaves/allocate",
                        "/leaves/requests",
                        "/leaves/requests/{public_id}",
                        "/leaves/requests/{public_id}/action",
                        "/leaves/requests/{public_id}/cancel",
                        // ── Compensation & Salaries ────────────────────────────
                        "/salaries",
                        "/salaries/{public_id}",
                        "/salaries/me",
                        "/salaries/{employee_public_id}",
                        // ── Bank Details ───────────────────────────────────────
                        "/bank-details",
                        "/bank-details/{public_id}",
                        "/bank-details/me",
                        "/bank-details/{employee_public_id}",
                        // ── Payroll Management ─────────────────────────────────
                        "/payroll/process",
                        "/payroll/runs",
                        "/payroll/runs/{payroll_public_id}",
                        "/payroll/runs/{payroll_public_id}/disburse",
                        // ── Project Management ─────────────────────────────────
                        "/projects",
                        "/projects/{public_id}",
                        "/projects/{public_id}/members",
                        "/projects/{public_id}/members/{employee_public_id}",
                        // ── Performance Reviews ────────────────────────────────
                        "/reviews",
                        "/reviews/{public_id}",
                        // ── Document Management ────────────────────────────────
                        "/documents/register",
                        "/documents/upload",
                        "/documents/employee/{employee_public_id}",
                        "/documents/{public_id}",
                        // ── Announcements & Notifications ──────────────────────
                        "/announcements",
                        "/announcements/{public_id}",
                        "/announcements/notifications/send",
                        "/announcements/notifications/inbox",
                        "/announcements/notifications/{recipient_id}/read",
                        // ── Audit Trail & Compliance ───────────────────────────
                        "/audit-logs",
                        // ── Root / System ──────────────────────────────────────
                        "/",
                        "/health"
                );

                for (String path : preferredOrder) {
                    if (openApi.getPaths().containsKey(path)) {
                        sortedPaths.put(path, openApi.getPaths().get(path));
                    }
                }
                // Append any paths not in the preferred order (safety net)
                openApi.getPaths().forEach((k, v) -> {
                    if (!sortedPaths.containsKey(k)) {
                        sortedPaths.put(k, v);
                    }
                });
                openApi.setPaths(sortedPaths);
            }
        };
    }
}
