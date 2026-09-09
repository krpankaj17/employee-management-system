package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.PaginatedAuditLogs;
import com.datansh.EmployeeManagment.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;

@RestController
@RequestMapping({"/audit-logs", "/audit"})
@Tag(name = "Audit Trail & Compliance", description = "System activity and modification trails")
public class AuditController {

    @Autowired
    private AuditService auditService;

    @GetMapping
    @PreAuthorize("hasAuthority('audit:view') or hasAuthority('audit:read') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Lists system activity and data mutation audit trails with filtering and pagination")
    public ResponseEntity<PaginatedAuditLogs> listAuditLogs(
            @RequestParam(required = false) String entity_name,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String user_public_id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime date_from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime date_to,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(auditService.listAuditLogs(entity_name, action, user_public_id, date_from, date_to, skip, limit));
    }
}

