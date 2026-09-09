package com.datansh.EmployeeManagment.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping("/")
    @Tag(name = "default")
    @Operation(summary = "Root")
    public ResponseEntity<Map<String, Object>> root() {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Employee Management System API is running (Spring Boot)");
        response.put("database", "connected");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    @Tag(name = "System")
    @Operation(summary = "Health Check")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        Map<String, String> db = new HashMap<>();
        db.put("status", "connected");
        db.put("database", "employee_management");
        response.put("database", db);
        return ResponseEntity.ok(response);
    }
}

