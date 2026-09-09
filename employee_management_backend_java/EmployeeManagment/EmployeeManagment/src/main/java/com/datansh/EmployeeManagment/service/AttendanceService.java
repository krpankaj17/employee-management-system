package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.Attendance;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ConflictException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.AttendanceRepository;
import com.datansh.EmployeeManagment.repository.DepartmentRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class AttendanceService {

    private static final Set<String> VALID_WORK_MODES = Set.of("in_office", "remote", "field");
    private static final Set<String> VALID_STATUSES = Set.of("present", "half_day", "absent", "on_leave", "not_checked_in");

    // Standard shift start time (09:00 AM) and grace threshold (09:15 AM)
    private static final LocalTime STANDARD_SHIFT_START = LocalTime.of(9, 0, 0);
    private static final LocalTime GRACE_SHIFT_THRESHOLD = LocalTime.of(9, 15, 0);

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    public ZoneId resolveZoneId(String tzName) {
        if (tzName == null || tzName.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(tzName.trim());
        } catch (Exception e) {
            log.warn("[ATTENDANCE] Invalid timezone '{}', defaulting to UTC", tzName);
            return ZoneOffset.UTC;
        }
    }

    public AttendanceOut checkIn(UUID employeePublicId, String workMode, String notes, String timezone) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with publicId '" + employeePublicId + "' not found"));

        // Validate employee active status
        String empStatus = employee.getEmployeeStatus();
        if ("terminated".equalsIgnoreCase(empStatus) || "inactive".equalsIgnoreCase(empStatus) || Boolean.FALSE.equals(employee.getIsActive())) {
            log.warn("[ATTENDANCE] Check-in rejected - inactive employee: empId={}, status={}", employee.getEmpId(), empStatus);
            throw new BadRequestException("Cannot check in: Employee " + employee.getEmpId() + " status is '" + (empStatus != null ? empStatus : "inactive") + "'");
        }

        // Validate work mode
        String mode = (workMode != null && !workMode.isBlank()) ? workMode.trim().toLowerCase() : "in_office";
        if (!VALID_WORK_MODES.contains(mode)) {
            throw new BadRequestException("work_mode must be one of " + VALID_WORK_MODES);
        }

        // Resolve timezone (explicit timezone > employee profile timezone > UTC)
        String tzName = (timezone != null && !timezone.isBlank())
                ? timezone.trim()
                : (employee.getTimezone() != null && !employee.getTimezone().isBlank() ? employee.getTimezone().trim() : "UTC");
        ZoneId zoneId = resolveZoneId(tzName);
        String resolvedTzName = zoneId.getId();

        // Exact server-authoritative live punch timestamps
        Instant nowInstant = Instant.now();
        ZonedDateTime nowLocal = nowInstant.atZone(zoneId);
        LocalDate localToday = nowLocal.toLocalDate();
        LocalTime localPunchTime = nowLocal.toLocalTime();
        OffsetDateTime nowUtc = nowInstant.atOffset(ZoneOffset.UTC);

        // Prevent duplicate open check-in on the same local calendar day (409 Conflict)
        Optional<Attendance> existing = attendanceRepository.findByEmployeeEmpIdAndDate(employee.getEmpId(), localToday);
        if (existing.isPresent() && existing.get().getCheckIn() != null) {
            log.warn("[ATTENDANCE] Check-in rejected - duplicate check-in: empId={}, date={}", employee.getEmpId(), localToday);
            throw new ConflictException("Employee " + employee.getEmpId() + " already has an active check-in at " + existing.get().getCheckIn() + " for today (" + localToday + ")");
        }

        // Determine late arrival against 09:15 AM grace threshold
        boolean isLate = localPunchTime.isAfter(GRACE_SHIFT_THRESHOLD);
        int lateMinutes = 0;
        if (isLate) {
            lateMinutes = (int) Duration.between(STANDARD_SHIFT_START, localPunchTime).toMinutes();
        }

        String autoNotes = (notes != null) ? notes.trim() : "";
        if (isLate) {
            String lateTag = "[Late Arrival: " + lateMinutes + " mins past 09:00]";
            autoNotes = autoNotes.isEmpty() ? lateTag : (lateTag + " " + autoNotes);
        }

        Attendance attendance = existing.orElse(Attendance.builder()
                .employee(employee)
                .date(localToday)
                .build());

        attendance.setCheckIn(nowUtc);
        attendance.setCheckOut(null);
        attendance.setDate(localToday);
        attendance.setWorkMode(mode);
        attendance.setStatus("present");
        attendance.setTimezone(resolvedTzName);
        attendance.setTotalHours(BigDecimal.ZERO);
        attendance.setNotes(autoNotes.isEmpty() ? null : autoNotes);

        attendance = attendanceRepository.save(attendance);
        log.info("[ATTENDANCE] Check-in recorded: empCode={}, tz={}, date={}, in={}, mode={}, isLate={}",
                employee.getEmployeeCode(), resolvedTzName, localToday, nowUtc, mode, isLate);
        return mapToDto(attendance);
    }

    public AttendanceOut checkOut(UUID employeePublicId, String notes) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with publicId '" + employeePublicId + "' not found"));

        // Find the open check-in record for this employee (where check_out is null)
        Attendance attendance = attendanceRepository.findFirstByEmployeeEmpIdAndCheckInIsNotNullAndCheckOutIsNullOrderByDateDescCheckInDesc(employee.getEmpId())
                .orElseThrow(() -> new ResourceNotFoundException("No open check-in record found for employee " + employee.getEmpId()));

        OffsetDateTime nowUtc = OffsetDateTime.now(ZoneOffset.UTC);
        attendance.setCheckOut(nowUtc);

        if (notes != null && !notes.isBlank()) {
            String existingNotes = attendance.getNotes();
            String combined = (existingNotes != null && !existingNotes.isBlank())
                    ? (existingNotes + " | " + notes.trim())
                    : notes.trim();
            attendance.setNotes(combined);
        }

        Duration duration = Duration.between(attendance.getCheckIn(), nowUtc);
        double hours = Math.max(0.0, (double) duration.toSeconds() / 3600.0);
        BigDecimal totalHours = BigDecimal.valueOf(hours).setScale(2, RoundingMode.HALF_UP);
        attendance.setTotalHours(totalHours);

        // Any employee who checks in and checks out is marked 'present', never 'absent'
        attendance.setStatus("present");

        attendance = attendanceRepository.save(attendance);
        log.info("[ATTENDANCE] Check-out recorded: empCode={}, totalHours={}, status={}",
                employee.getEmployeeCode(), totalHours, attendance.getStatus());
        return mapToDto(attendance);
    }

    public AttendanceOut createManualAttendance(ManualAttendanceIn payload) {
        if (payload.getEmployeePublicId() == null || payload.getEmployeePublicId().isBlank()) {
            throw new BadRequestException("employee_public_id is required for manual attendance creation");
        }

        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        LocalDate date = payload.getDate() != null ? payload.getDate() : LocalDate.now();

        String status = (payload.getStatus() != null && !payload.getStatus().isBlank())
                ? payload.getStatus().trim().toLowerCase()
                : "present";
        if (!VALID_STATUSES.contains(status)) {
            throw new BadRequestException("status must be one of " + VALID_STATUSES);
        }

        String workMode = (payload.getWorkMode() != null && !payload.getWorkMode().isBlank())
                ? payload.getWorkMode().trim().toLowerCase()
                : "in_office";
        if (!VALID_WORK_MODES.contains(workMode)) {
            throw new BadRequestException("work_mode must be one of " + VALID_WORK_MODES);
        }

        // Strict business rule for future dates
        LocalDate today = LocalDate.now();
        if (date.isAfter(today)) {
            if (!"on_leave".equalsIgnoreCase(status)) {
                throw new BadRequestException("Cannot create attendance for future dates unless status is 'on_leave'");
            }
            if (payload.getCheckIn() != null || payload.getCheckOut() != null) {
                throw new BadRequestException("Future leave records must not have check-in or check-out times");
            }
        }

        Optional<Attendance> existing = attendanceRepository.findByEmployeeEmpIdAndDate(employee.getEmpId(), date);
        if (existing.isPresent()) {
            throw new ConflictException("Attendance record already exists for employee " + employee.getEmpId() + " on " + date);
        }

        String tzName = (payload.getTimezone() != null && !payload.getTimezone().isBlank())
                ? payload.getTimezone().trim()
                : (employee.getTimezone() != null && !employee.getTimezone().isBlank() ? employee.getTimezone().trim() : "UTC");
        ZoneId zoneId = resolveZoneId(tzName);

        OffsetDateTime checkInDt = parseDateTime(date, payload.getCheckIn(), zoneId);
        OffsetDateTime checkOutDt = parseDateTime(date, payload.getCheckOut(), zoneId);

        if (checkInDt != null && checkOutDt != null && !checkOutDt.isAfter(checkInDt)) {
            throw new BadRequestException("check_out time must be after check_in time");
        }

        BigDecimal totalHours = BigDecimal.ZERO;
        if (checkInDt != null && checkOutDt != null) {
            Duration duration = Duration.between(checkInDt, checkOutDt);
            double hours = Math.max(0.0, (double) duration.toSeconds() / 3600.0);
            totalHours = BigDecimal.valueOf(hours).setScale(2, RoundingMode.HALF_UP);
        }

        Attendance attendance = Attendance.builder()
                .employee(employee)
                .date(date)
                .checkIn(checkInDt)
                .checkOut(checkOutDt)
                .workMode(workMode)
                .status(status)
                .totalHours(totalHours)
                .timezone(zoneId.getId())
                .notes(payload.getNotes())
                .build();

        attendance = attendanceRepository.save(attendance);
        log.info("[ATTENDANCE] Manual attendance created: empCode={}, date={}, status={}", employee.getEmployeeCode(), date, status);
        return mapToDto(attendance);
    }

    public Attendance findAttendanceByIdOrPublicId(String idStr) {
        if (idStr == null || idStr.isBlank()) {
            throw new ResourceNotFoundException("Attendance record ID is required");
        }
        try {
            UUID uuid = UUID.fromString(idStr.trim());
            Optional<Attendance> opt = attendanceRepository.findByPublicId(uuid);
            if (opt.isPresent()) return opt.get();
        } catch (IllegalArgumentException ignored) {}

        try {
            Long id = Long.parseLong(idStr.trim());
            Optional<Attendance> opt = attendanceRepository.findById(id);
            if (opt.isPresent()) return opt.get();
        } catch (NumberFormatException ignored) {}

        throw new ResourceNotFoundException("Attendance record not found with id " + idStr);
    }

    public AttendanceOut updateAttendanceRecord(String attendanceId, AttendanceUpdateIn payload) {
        Attendance attendance = findAttendanceByIdOrPublicId(attendanceId);

        if (payload.getWorkMode() != null && !payload.getWorkMode().isBlank()) {
            String mode = payload.getWorkMode().trim().toLowerCase();
            if (!VALID_WORK_MODES.contains(mode)) {
                throw new BadRequestException("work_mode must be one of " + VALID_WORK_MODES);
            }
            attendance.setWorkMode(mode);
        }
        if (payload.getStatus() != null && !payload.getStatus().isBlank()) {
            String st = payload.getStatus().trim().toLowerCase();
            if (!VALID_STATUSES.contains(st)) {
                throw new BadRequestException("status must be one of " + VALID_STATUSES);
            }
            attendance.setStatus(st);
        }
        if (payload.getNotes() != null) {
            attendance.setNotes(payload.getNotes());
        }
        if (payload.getTimezone() != null && !payload.getTimezone().isBlank()) {
            ZoneId zoneId = resolveZoneId(payload.getTimezone());
            attendance.setTimezone(zoneId.getId());
        }

        attendance = attendanceRepository.save(attendance);
        return mapToDto(attendance);
    }

    public void deleteAttendanceRecord(String attendanceId) {
        Attendance attendance = findAttendanceByIdOrPublicId(attendanceId);
        attendanceRepository.delete(attendance);
    }

    @Transactional(readOnly = true)
    public PaginatedAttendance getAllAttendance(
            String employeePublicId, String departmentPublicId,
            LocalDate dateFrom, LocalDate dateTo,
            String status, String workMode,
            int skip, Integer limit
    ) {
        Specification<Attendance> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (employeePublicId != null && !employeePublicId.isBlank()) {
                predicates.add(cb.equal(root.get("employee").get("publicId"), UUID.fromString(employeePublicId)));
            }
            if (departmentPublicId != null && !departmentPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("employee").get("department").get("publicId"), UUID.fromString(departmentPublicId)));
            }
            if (dateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("date"), dateFrom));
            }
            if (dateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("date"), dateTo));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.trim().toLowerCase()));
            }
            if (workMode != null && !workMode.isBlank()) {
                predicates.add(cb.equal(root.get("workMode"), workMode.trim().toLowerCase()));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        Pageable pageable = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "date").and(Sort.by(Sort.Direction.DESC, "attendanceId")));

        Page<Attendance> page = attendanceRepository.findAll(spec, pageable);

        List<AttendanceOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return PaginatedAttendance.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public MonthlyAttendanceSummary getMonthlySummary(UUID employeePublicId, int year, int month) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<Attendance> records = attendanceRepository.findByEmployeeAndDateRange(employee.getEmpId(), start, end);

        int present = 0;
        int halfDay = 0;
        int onLeave = 0;
        int absent = 0;
        BigDecimal totalHours = BigDecimal.ZERO;

        for (Attendance a : records) {
            String st = a.getStatus();
            if ("present".equalsIgnoreCase(st)) present++;
            else if ("half_day".equalsIgnoreCase(st)) halfDay++;
            else if ("on_leave".equalsIgnoreCase(st)) onLeave++;
            else if ("absent".equalsIgnoreCase(st)) absent++;

            if (a.getTotalHours() != null) {
                totalHours = totalHours.add(a.getTotalHours());
            }
        }

        BigDecimal avgDailyHours = records.isEmpty() ? BigDecimal.ZERO : totalHours.divide(BigDecimal.valueOf(records.size()), 2, RoundingMode.HALF_UP);

        return MonthlyAttendanceSummary.builder()
                .employeePublicId(employee.getPublicId().toString())
                .employeeName(employee.getFullName())
                .year(year)
                .month(month)
                .monthName(ym.getMonth().name())
                .daysInMonth(ym.lengthOfMonth())
                .totalDaysLogged(records.size())
                .daysPresent(present)
                .daysHalfDay(halfDay)
                .daysOnLeave(onLeave)
                .daysAbsent(absent)
                .totalHoursWorked(totalHours)
                .avgDailyHours(avgDailyHours)
                .records(records.stream().map(this::mapToDto).collect(Collectors.toList()))
                .build();
    }

    @Transactional(readOnly = true)
    public YearlyAttendanceSummary getYearlySummary(UUID employeePublicId, int year) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        List<MonthlyBreakdownItem> breakdown = new ArrayList<>();
        int totalPresent = 0;
        int totalHalfDay = 0;
        int totalOnLeave = 0;
        int totalAbsent = 0;
        BigDecimal totalAnnualHours = BigDecimal.ZERO;

        for (int m = 1; m <= 12; m++) {
            MonthlyAttendanceSummary monthly = getMonthlySummary(employeePublicId, year, m);
            totalPresent += monthly.getDaysPresent();
            totalHalfDay += monthly.getDaysHalfDay();
            totalOnLeave += monthly.getDaysOnLeave();
            totalAbsent += monthly.getDaysAbsent();
            totalAnnualHours = totalAnnualHours.add(monthly.getTotalHoursWorked());

            breakdown.add(MonthlyBreakdownItem.builder()
                    .month(m)
                    .monthName(Month.of(m).name())
                    .daysPresent(monthly.getDaysPresent())
                    .daysHalfDay(monthly.getDaysHalfDay())
                    .daysOnLeave(monthly.getDaysOnLeave())
                    .daysAbsent(monthly.getDaysAbsent())
                    .totalHoursWorked(monthly.getTotalHoursWorked())
                    .avgDailyHours(monthly.getAvgDailyHours())
                    .build());
        }

        BigDecimal avgMonthlyHours = totalAnnualHours.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);

        return YearlyAttendanceSummary.builder()
                .employeePublicId(employee.getPublicId().toString())
                .employeeName(employee.getFullName())
                .year(year)
                .totalDaysPresent(totalPresent)
                .totalDaysHalfDay(totalHalfDay)
                .totalDaysOnLeave(totalOnLeave)
                .totalDaysAbsent(totalAbsent)
                .totalAnnualHours(totalAnnualHours)
                .avgMonthlyHours(avgMonthlyHours)
                .monthlyBreakdown(breakdown)
                .build();
    }

    private OffsetDateTime parseDateTime(LocalDate date, String timeStr, ZoneId zoneId) {
        if (timeStr == null || timeStr.isBlank()) return null;
        String s = timeStr.trim();
        try {
            if (s.contains("T")) {
                return OffsetDateTime.parse(s.replace("Z", "+00:00"));
            }
            LocalTime time = LocalTime.parse(s, DateTimeFormatter.ofPattern("H:m[:s]"));
            ZonedDateTime zdt = date.atTime(time).atZone(zoneId != null ? zoneId : ZoneOffset.UTC);
            return zdt.toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            log.warn("[ATTENDANCE] Failed to parse time string '{}': {}", timeStr, e.getMessage());
            return null;
        }
    }

    public AttendanceOut mapToDto(Attendance a) {
        boolean isLate = false;
        int lateMinutes = 0;
        if (a.getCheckIn() != null) {
            String tzName = (a.getTimezone() != null && !a.getTimezone().isBlank()) ? a.getTimezone() : "UTC";
            ZoneId zoneId = resolveZoneId(tzName);
            LocalTime localCheckIn = a.getCheckIn().atZoneSameInstant(zoneId).toLocalTime();
            if (localCheckIn.isAfter(GRACE_SHIFT_THRESHOLD)) {
                isLate = true;
                lateMinutes = (int) Duration.between(STANDARD_SHIFT_START, localCheckIn).toMinutes();
            }
        }

        String empName = null;
        String empCode = null;
        String deptName = null;
        if (a.getEmployee() != null) {
            Employee emp = a.getEmployee();
            empName = ((emp.getFirstName() != null ? emp.getFirstName() : "") + " "
                    + (emp.getLastName() != null ? emp.getLastName() : "")).trim();
            empCode = emp.getEmployeeCode();
            try {
                if (emp.getDepartment() != null) {
                    deptName = emp.getDepartment().getDeptName();
                }
            } catch (Exception ignored) {}
        }

        return AttendanceOut.builder()
                .id(a.getAttendanceId())
                .attendanceId(a.getAttendanceId())
                .publicId(a.getPublicId() != null ? a.getPublicId().toString() : null)
                .employeePublicId(a.getEmployee() != null && a.getEmployee().getPublicId() != null ? a.getEmployee().getPublicId().toString() : null)
                .employeeName(empName)
                .employeeCode(empCode)
                .departmentName(deptName)
                .date(a.getDate() != null ? a.getDate().toString() : "")
                .checkIn(a.getCheckIn() != null ? a.getCheckIn().toString() : null)
                .checkOut(a.getCheckOut() != null ? a.getCheckOut().toString() : null)
                .timezone(a.getTimezone() != null ? a.getTimezone() : "UTC")
                .workMode(a.getWorkMode() != null ? a.getWorkMode() : "in_office")
                .status(a.getStatus() != null ? a.getStatus() : "present")
                .totalHours(a.getTotalHours() != null ? a.getTotalHours() : BigDecimal.ZERO)
                .isLate(isLate)
                .lateMinutes(lateMinutes)
                .notes(a.getNotes())
                .build();
    }
}
