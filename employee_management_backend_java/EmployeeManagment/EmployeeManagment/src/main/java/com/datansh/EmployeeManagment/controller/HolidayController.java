package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.HolidayIn;
import com.datansh.EmployeeManagment.dto.HolidayOut;
import com.datansh.EmployeeManagment.service.HolidayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/holidays")
@Tag(name = "Holiday Calendar", description = "Company and regional holiday calendar management")
public class HolidayController {

    @Autowired
    private HolidayService holidayService;

    @GetMapping
    @Operation(summary = "Lists company holidays by year and region with pagination")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.PaginatedHolidays> listHolidays(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(holidayService.listHolidays(year, region, skip, limit));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('attendance:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Creates a new calendar holiday")
    public ResponseEntity<HolidayOut> createHoliday(@Valid @RequestBody HolidayIn payload) {
        HolidayOut result = holidayService.createHoliday(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @DeleteMapping("/{public_id}")
    @PreAuthorize("hasAuthority('attendance:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes a holiday by UUID")
    public ResponseEntity<Map<String, String>> deleteHoliday(@PathVariable("public_id") String publicId) {
        holidayService.deleteHoliday(UUID.fromString(publicId));
        Map<String, String> res = new HashMap<>();
        res.put("details", "Holiday successfully deleted");
        return ResponseEntity.ok(res);
    }
}
