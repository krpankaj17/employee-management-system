package com.datansh.EmployeeManagment;

import com.datansh.EmployeeManagment.dto.AttendanceOut;
import com.datansh.EmployeeManagment.dto.MonthlyAttendanceSummary;
import com.datansh.EmployeeManagment.entity.Attendance;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ConflictException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.AttendanceRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.service.AttendanceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AttendanceServiceUnitTest {

    @Mock
    private AttendanceRepository attendanceRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private AttendanceService attendanceService;

    @Test
    @DisplayName("Should successfully check-in employee for today")
    void testCheckIn() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .firstName("John")
                .lastName("Doe")
                .employeeStatus("active")
                .isActive(true)
                .timezone("Asia/Kolkata")
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));
        when(attendanceRepository.findByEmployeeEmpIdAndDate(eq(10L), any(LocalDate.class))).thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(invocation -> {
            Attendance att = invocation.getArgument(0);
            att.setAttendanceId(100L);
            att.setPublicId(UUID.randomUUID());
            return att;
        });

        AttendanceOut result = attendanceService.checkIn(empPublicId, "in_office", "First punch of the day", "Asia/Kolkata");

        assertNotNull(result);
        assertEquals("present", result.getStatus());
        assertEquals("in_office", result.getWorkMode());
        assertEquals("Asia/Kolkata", result.getTimezone());
        assertEquals(empPublicId.toString(), result.getEmployeePublicId());
    }

    @Test
    @DisplayName("Should throw 409 Conflict when duplicate check-in is attempted on same day")
    void testCheckInDuplicateThrowsConflict() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .employeeStatus("active")
                .isActive(true)
                .timezone("UTC")
                .build();

        Attendance existingAtt = Attendance.builder()
                .attendanceId(1L)
                .employee(employee)
                .date(LocalDate.now())
                .checkIn(OffsetDateTime.now(ZoneOffset.UTC).minusHours(2))
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));
        when(attendanceRepository.findByEmployeeEmpIdAndDate(eq(10L), any(LocalDate.class))).thenReturn(Optional.of(existingAtt));

        assertThrows(ConflictException.class, () -> {
            attendanceService.checkIn(empPublicId, "in_office", "Duplicate check-in", "UTC");
        });
    }

    @Test
    @DisplayName("Should throw BadRequestException when inactive employee tries to check in")
    void testCheckInInactiveEmployeeThrowsBadRequest() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .employeeStatus("terminated")
                .isActive(false)
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));

        assertThrows(BadRequestException.class, () -> {
            attendanceService.checkIn(empPublicId, "in_office", null, null);
        });
    }

    @Test
    @DisplayName("Should successfully check-out open check-in record and calculate present status for 8+ hours")
    void testCheckOutSuccessPresent() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .timezone("UTC")
                .build();

        OffsetDateTime eightHoursAgo = OffsetDateTime.now(ZoneOffset.UTC).minusHours(8).minusMinutes(30);
        Attendance openAtt = Attendance.builder()
                .attendanceId(50L)
                .publicId(UUID.randomUUID())
                .employee(employee)
                .date(LocalDate.now())
                .checkIn(eightHoursAgo)
                .checkOut(null)
                .workMode("in_office")
                .status("present")
                .timezone("UTC")
                .notes("Morning punch")
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));
        when(attendanceRepository.findFirstByEmployeeEmpIdAndCheckInIsNotNullAndCheckOutIsNullOrderByDateDescCheckInDesc(10L))
                .thenReturn(Optional.of(openAtt));
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AttendanceOut result = attendanceService.checkOut(empPublicId, "Leaving for the day");

        assertNotNull(result);
        assertNotNull(result.getCheckOut());
        assertEquals("present", result.getStatus());
        assertTrue(result.getTotalHours().doubleValue() >= 8.0);
        assertTrue(result.getNotes().contains("Morning punch | Leaving for the day"));
    }

    @Test
    @DisplayName("Should throw ResourceNotFoundException when checking out with no open check-in")
    void testCheckOutNoOpenRecordThrowsNotFound() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));
        when(attendanceRepository.findFirstByEmployeeEmpIdAndCheckInIsNotNullAndCheckOutIsNullOrderByDateDescCheckInDesc(10L))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> {
            attendanceService.checkOut(empPublicId, "No punch in exists");
        });
    }

    @Test
    @DisplayName("Should calculate monthly attendance summary properly")
    void testMonthlySummary() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(10L)
                .publicId(empPublicId)
                .firstName("Jane")
                .lastName("Smith")
                .build();

        Attendance a1 = Attendance.builder()
                .attendanceId(1L)
                .publicId(UUID.randomUUID())
                .employee(employee)
                .date(LocalDate.of(2026, 1, 5))
                .status("present")
                .totalHours(BigDecimal.valueOf(8.50))
                .build();

        Attendance a2 = Attendance.builder()
                .attendanceId(2L)
                .publicId(UUID.randomUUID())
                .employee(employee)
                .date(LocalDate.of(2026, 1, 6))
                .status("half_day")
                .totalHours(BigDecimal.valueOf(4.00))
                .build();

        when(employeeRepository.findByPublicId(empPublicId)).thenReturn(Optional.of(employee));
        when(attendanceRepository.findByEmployeeAndDateRange(eq(10L), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(a1, a2));

        MonthlyAttendanceSummary summary = attendanceService.getMonthlySummary(empPublicId, 2026, 1);

        assertNotNull(summary);
        assertEquals(2, summary.getTotalDaysLogged());
        assertEquals(1, summary.getDaysPresent());
        assertEquals(1, summary.getDaysHalfDay());
        assertEquals(0, summary.getDaysAbsent());
        assertEquals(BigDecimal.valueOf(12.50).setScale(2), summary.getTotalHoursWorked().setScale(2));
    }
}
