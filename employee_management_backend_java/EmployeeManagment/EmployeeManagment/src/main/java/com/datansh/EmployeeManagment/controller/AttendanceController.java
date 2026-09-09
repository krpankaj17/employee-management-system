package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.AttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/attendance")
@Tag(name = "Attendance Management", description = "Live punch in/out, shift time tracking, manual records and attendance analytics")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private com.datansh.EmployeeManagment.repository.EmployeeRepository employeeRepository;

    private UUID resolveEmployeePublicId(UserDetailsImpl currentUser) {
        if (currentUser == null) {
            throw new ForbiddenException("Authentication required to record attendance.");
        }
        if (currentUser.getEmployeePublicId() != null) {
            return currentUser.getEmployeePublicId();
        }
        if (currentUser.getEmail() != null) {
            var empOpt = employeeRepository.findByEmail(currentUser.getEmail());
            if (empOpt.isPresent()) {
                return empOpt.get().getPublicId();
            }
        }
        if (currentUser.getId() != null) {
            var empOpt = employeeRepository.findByUserUserId(currentUser.getId());
            if (empOpt.isPresent()) {
                return empOpt.get().getPublicId();
            }
        }
        throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
    }

    @PostMapping("/check-in")
    @Operation(summary = "Records an employee live check-in with exact server-side timestamp")
    public ResponseEntity<AttendanceOut> checkIn(
            @RequestBody(required = false) CheckInIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        UUID employeePublicId = resolveEmployeePublicId(currentUser);

        CheckInIn body = payload != null ? payload : new CheckInIn();
        AttendanceOut result = attendanceService.checkIn(
                employeePublicId,
                body.getWorkMode(),
                body.getNotes(),
                body.getTimezone()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/check-out")
    @Operation(summary = "Records an employee live check-out with exact server-side timestamp")
    public ResponseEntity<AttendanceOut> checkOut(
            @RequestBody(required = false) CheckOutIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        UUID employeePublicId = resolveEmployeePublicId(currentUser);

        CheckOutIn body = payload != null ? payload : new CheckOutIn();
        AttendanceOut result = attendanceService.checkOut(
                employeePublicId,
                body.getNotes()
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping("/records")
    @PreAuthorize("hasAuthority('attendance:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Administrative override endpoint for HR/Managers to backfill missed punches")
    public ResponseEntity<AttendanceOut> createManualRecord(
            @Valid @RequestBody ManualAttendanceIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        if ((payload.getEmployeePublicId() == null || payload.getEmployeePublicId().isBlank()) && currentUser != null && currentUser.getEmployeePublicId() != null) {
            payload.setEmployeePublicId(currentUser.getEmployeePublicId().toString());
        }
        AttendanceOut result = attendanceService.createManualAttendance(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/records/{attendance_id}")
    @PreAuthorize("hasAuthority('attendance:update') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Administrative update of an existing attendance record")
    public ResponseEntity<AttendanceOut> updateAttendance(
            @PathVariable("attendance_id") String attendanceId,
            @Valid @RequestBody AttendanceUpdateIn payload
    ) {
        AttendanceOut result = attendanceService.updateAttendanceRecord(attendanceId, payload);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/records/{attendance_id}")
    @PreAuthorize("hasAuthority('attendance:delete') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Deletes an attendance record by ID")
    public ResponseEntity<Map<String, String>> deleteAttendance(@PathVariable("attendance_id") String attendanceId) {
        attendanceService.deleteAttendanceRecord(attendanceId);
        Map<String, String> res = new HashMap<>();
        res.put("details", "Attendance record successfully deleted");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/records")
    @Operation(summary = "Retrieves filtered and paginated attendance records")
    public ResponseEntity<PaginatedAttendance> getAllAttendance(
            @RequestParam(required = false) String employee_public_id,
            @RequestParam(required = false) String department_public_id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date_from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date_to,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String work_mode,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser.hasPermission("attendance:view") || currentUser.hasPermission("attendance:read");
        String effectiveEmpId = employee_public_id;
        String effectiveDeptId = department_public_id;

        if (!hasPerm) {
            if (currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
            }
            if (employee_public_id != null && !employee_public_id.equalsIgnoreCase(currentUser.getEmployeePublicId().toString())) {
                throw new ForbiddenException("Access not granted: You do not have permission to view attendance records for other employees.");
            }
            effectiveEmpId = currentUser.getEmployeePublicId().toString();
            effectiveDeptId = null;
        }

        PaginatedAttendance result = attendanceService.getAllAttendance(
                effectiveEmpId, effectiveDeptId, date_from, date_to, status, work_mode, skip, limit
        );
        return ResponseEntity.ok(result);
    }
}
