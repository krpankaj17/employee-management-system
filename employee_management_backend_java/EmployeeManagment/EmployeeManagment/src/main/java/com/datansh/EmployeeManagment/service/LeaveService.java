package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class LeaveService {

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private EmployeeLeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private LeaveApprovalHistoryRepository leaveApprovalHistoryRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "leave_types", key = "'all'")
    public List<LeaveTypeOut> getAllLeaveTypes() {
        return leaveTypeRepository.findAll().stream()
                .map(this::mapToLeaveTypeOut)
                .collect(Collectors.toList());
    }

    @CacheEvict(value = "leave_types", allEntries = true)
    public LeaveTypeOut createLeaveType(LeaveTypeIn payload) {
        if (leaveTypeRepository.existsByName(payload.getName())) {
            throw new BadRequestException("Leave type with name '" + payload.getName() + "' already exists");
        }

        LeaveType lt = LeaveType.builder()
                .name(payload.getName())
                .description(payload.getDescription())
                .maxDaysPerYear(payload.getMaxDaysPerYear() != null ? payload.getMaxDaysPerYear() : 0)
                .isPaid(payload.getIsPaid() != null ? payload.getIsPaid() : true)
                .build();

        lt = leaveTypeRepository.save(lt);
        return mapToLeaveTypeOut(lt);
    }

    @CacheEvict(value = "leave_types", allEntries = true)
    public LeaveTypeOut updateLeaveType(UUID publicId, LeaveTypeIn payload) {
        LeaveType lt = leaveTypeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave type not found with public_id " + publicId));

        if (payload.getName() != null && !payload.getName().equalsIgnoreCase(lt.getName())) {
            if (leaveTypeRepository.existsByName(payload.getName())) {
                throw new BadRequestException("Leave type with name '" + payload.getName() + "' already exists");
            }
            lt.setName(payload.getName());
        }
        if (payload.getDescription() != null) lt.setDescription(payload.getDescription());
        if (payload.getMaxDaysPerYear() != null) lt.setMaxDaysPerYear(payload.getMaxDaysPerYear());
        if (payload.getIsPaid() != null) lt.setIsPaid(payload.getIsPaid());

        lt = leaveTypeRepository.save(lt);
        return mapToLeaveTypeOut(lt);
    }

    @CacheEvict(value = "leave_types", allEntries = true)
    public void deleteLeaveType(UUID publicId) {
        LeaveType lt = leaveTypeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave type not found with public_id " + publicId));
        leaveTypeRepository.delete(lt);
    }

    @Transactional
    public List<LeaveBalanceOut> getEmployeeLeaveBalances(UUID employeePublicId, Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        List<EmployeeLeaveBalance> existing = leaveBalanceRepository.findByEmployeeEmpIdAndYear(employee.getEmpId(), y);
        Set<Long> existingTypeIds = existing.stream()
                .map(b -> b.getLeaveType().getLeaveTypeId())
                .collect(Collectors.toSet());

        List<LeaveType> allTypes = leaveTypeRepository.findAll();
        boolean added = false;
        for (LeaveType lt : allTypes) {
            if (!existingTypeIds.contains(lt.getLeaveTypeId())) {
                EmployeeLeaveBalance newBal = EmployeeLeaveBalance.builder()
                        .employee(employee)
                        .leaveType(lt)
                        .year(y)
                        .totalAllocated(lt.getMaxDaysPerYear() != null ? lt.getMaxDaysPerYear() : 0)
                        .usedLeaves(0)
                        .build();
                leaveBalanceRepository.save(newBal);
                added = true;
            }
        }
        if (added) {
            existing = leaveBalanceRepository.findByEmployeeEmpIdAndYear(employee.getEmpId(), y);
        }

        return existing.stream()
                .map(this::mapToBalanceOut)
                .collect(Collectors.toList());
    }

    public LeaveBalanceOut allocateLeaveBalance(LeaveBalanceIn payload) {
        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        LeaveType leaveType = leaveTypeRepository.findByPublicId(UUID.fromString(payload.getLeaveTypePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Leave type not found"));

        Optional<EmployeeLeaveBalance> existingOpt = leaveBalanceRepository.findByEmployeeEmpIdAndLeaveTypeLeaveTypeIdAndYear(
                employee.getEmpId(), leaveType.getLeaveTypeId(), payload.getYear()
        );

        EmployeeLeaveBalance balance;
        if (existingOpt.isPresent()) {
            balance = existingOpt.get();
            balance.setTotalAllocated(payload.getAllocatedDays());
        } else {
            balance = EmployeeLeaveBalance.builder()
                    .employee(employee)
                    .leaveType(leaveType)
                    .year(payload.getYear())
                    .totalAllocated(payload.getAllocatedDays())
                    .usedLeaves(0)
                    .build();
        }

        balance = leaveBalanceRepository.save(balance);
        return mapToBalanceOut(balance);
    }

    public LeaveRequestOut submitLeaveRequest(LeaveRequestIn payload, Long submittingEmpId) {
        Employee employee;
        if (payload.getEmployeePublicId() != null && !payload.getEmployeePublicId().isBlank()) {
            employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        } else if (submittingEmpId != null) {
            employee = employeeRepository.findById(submittingEmpId)
                    .orElseThrow(() -> new ResourceNotFoundException("Submitting employee not found"));
        } else {
            throw new BadRequestException("Employee must be specified");
        }

        if (payload.getStartDate().isAfter(payload.getEndDate())) {
            throw new BadRequestException("Start date cannot be after end date");
        }

        LeaveType leaveType = leaveTypeRepository.findByPublicId(UUID.fromString(payload.getLeaveTypePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Leave type not found"));

        long days = ChronoUnit.DAYS.between(payload.getStartDate(), payload.getEndDate()) + 1;
        BigDecimal totalDays = BigDecimal.valueOf(days);

        // Check balance
        int year = payload.getStartDate().getYear();
        Optional<EmployeeLeaveBalance> balOpt = leaveBalanceRepository.findByEmployeeEmpIdAndLeaveTypeLeaveTypeIdAndYear(
                employee.getEmpId(), leaveType.getLeaveTypeId(), year
        );

        if (balOpt.isEmpty() || balOpt.get().getRemainingLeaves() < days) {
            int available = balOpt.map(EmployeeLeaveBalance::getRemainingLeaves).orElse(0);
            throw new BadRequestException("Insufficient leave balance. Requested: " + days + " days, Available: " + available + " days");
        }

        LeaveRequest leaveRequest = LeaveRequest.builder()
                .employee(employee)
                .leaveType(leaveType)
                .startDate(payload.getStartDate())
                .endDate(payload.getEndDate())
                .totalDays(totalDays)
                .reason(payload.getReason())
                .status("pending")
                .build();

        leaveRequest = leaveRequestRepository.save(leaveRequest);

        // Log history
        LeaveApprovalHistory history = LeaveApprovalHistory.builder()
                .leaveRequest(leaveRequest)
                .actionBy(employee)
                .action("submitted")
                .remarks(payload.getReason())
                .actionAt(OffsetDateTime.now())
                .build();
        leaveApprovalHistoryRepository.save(history);

        return mapToRequestOut(leaveRequest);
    }

    @Transactional(readOnly = true)
    public PaginatedLeaveRequests getLeaveRequests(String employeePublicId, String statusFilter, int skip, Integer limit) {
        Specification<LeaveRequest> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (employeePublicId != null && !employeePublicId.isBlank()) {
                predicates.add(cb.equal(root.get("employee").get("publicId"), UUID.fromString(employeePublicId)));
            }
            if (statusFilter != null && !statusFilter.isBlank()) {
                predicates.add(cb.equal(root.get("status"), statusFilter));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        Pageable pageable = PageRequest.of(pageNumber, pageSize);

        Page<LeaveRequest> page = leaveRequestRepository.findAll(spec, pageable);

        List<LeaveRequestOut> items = page.getContent().stream()
                .map(this::mapToRequestOut)
                .collect(Collectors.toList());

        return PaginatedLeaveRequests.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public LeaveRequestOut getLeaveRequestDetail(UUID publicId) {
        LeaveRequest leaveRequest = leaveRequestRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave request with public_id '" + publicId + "' not found"));
        return mapToRequestOut(leaveRequest);
    }

    public LeaveRequestOut processLeaveApproval(UUID publicId, Long actorEmpId, LeaveApprovalActionIn payload) {
        LeaveRequest leaveRequest = leaveRequestRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave request not found"));

        if (leaveRequest.getEmployee().getEmpId().equals(actorEmpId)) {
            throw new ForbiddenException("Self-approval is strictly prohibited: you cannot approve/reject your own leave request.");
        }

        Employee actor = employeeRepository.findById(actorEmpId)
                .orElseThrow(() -> new ResourceNotFoundException("Approving employee profile not found"));

        String action = payload.getAction().toLowerCase();

        if ("approved".equals(action)) {
            leaveRequest.setStatus("approved");
            leaveRequest.setApprovedBy(actor);

            // Deduct balance
            int year = leaveRequest.getStartDate().getYear();
            EmployeeLeaveBalance balance = leaveBalanceRepository.findByEmployeeEmpIdAndLeaveTypeLeaveTypeIdAndYear(
                    leaveRequest.getEmployee().getEmpId(), leaveRequest.getLeaveType().getLeaveTypeId(), year
            ).orElseThrow(() -> new BadRequestException("Leave balance record not found for employee"));

            balance.setUsedLeaves(balance.getUsedLeaves() + leaveRequest.getTotalDays().intValue());
            leaveBalanceRepository.save(balance);

        } else if ("rejected".equals(action)) {
            leaveRequest.setStatus("rejected");
            leaveRequest.setApprovedBy(actor);
            leaveRequest.setRejectionReason(payload.getRejectionReason() != null ? payload.getRejectionReason() : payload.getRemarks());
        } else if ("escalated".equals(action)) {
            leaveRequest.setStatus("pending");
        } else {
            throw new BadRequestException("Invalid action: " + payload.getAction());
        }

        leaveRequest = leaveRequestRepository.save(leaveRequest);

        LeaveApprovalHistory history = LeaveApprovalHistory.builder()
                .leaveRequest(leaveRequest)
                .actionBy(actor)
                .action(action)
                .remarks(payload.getRemarks())
                .actionAt(OffsetDateTime.now())
                .build();
        leaveApprovalHistoryRepository.save(history);

        return mapToRequestOut(leaveRequest);
    }

    public LeaveRequestOut cancelLeaveRequest(UUID publicId, Long actorEmpId) {
        LeaveRequest leaveRequest = leaveRequestRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Leave request not found"));

        boolean wasApproved = "approved".equalsIgnoreCase(leaveRequest.getStatus());
        leaveRequest.setStatus("cancelled");
        leaveRequestRepository.save(leaveRequest);

        // Refund balance if previously approved
        if (wasApproved) {
            int year = leaveRequest.getStartDate().getYear();
            Optional<EmployeeLeaveBalance> balOpt = leaveBalanceRepository.findByEmployeeEmpIdAndLeaveTypeLeaveTypeIdAndYear(
                    leaveRequest.getEmployee().getEmpId(), leaveRequest.getLeaveType().getLeaveTypeId(), year
            );
            if (balOpt.isPresent()) {
                EmployeeLeaveBalance bal = balOpt.get();
                bal.setUsedLeaves(Math.max(0, bal.getUsedLeaves() - leaveRequest.getTotalDays().intValue()));
                leaveBalanceRepository.save(bal);
            }
        }

        Employee actor = actorEmpId != null ? employeeRepository.findById(actorEmpId).orElse(leaveRequest.getEmployee()) : leaveRequest.getEmployee();

        LeaveApprovalHistory history = LeaveApprovalHistory.builder()
                .leaveRequest(leaveRequest)
                .actionBy(actor)
                .action("cancelled")
                .remarks("Leave request cancelled by employee")
                .actionAt(OffsetDateTime.now())
                .build();
        leaveApprovalHistoryRepository.save(history);

        return mapToRequestOut(leaveRequest);
    }

    public LeaveTypeOut mapToLeaveTypeOut(LeaveType lt) {
        return LeaveTypeOut.builder()
                .publicId(lt.getPublicId().toString())
                .name(lt.getName())
                .description(lt.getDescription())
                .maxDaysPerYear(lt.getMaxDaysPerYear())
                .isPaid(lt.getIsPaid())
                .build();
    }

    public LeaveBalanceOut mapToBalanceOut(EmployeeLeaveBalance b) {
        return LeaveBalanceOut.builder()
                .publicId(b.getPublicId().toString())
                .employeePublicId(b.getEmployee() != null ? b.getEmployee().getPublicId().toString() : null)
                .employeeName(b.getEmployee() != null ? b.getEmployee().getFullName() : null)
                .leaveTypePublicId(b.getLeaveType() != null ? b.getLeaveType().getPublicId().toString() : null)
                .leaveTypeName(b.getLeaveType() != null ? b.getLeaveType().getName() : null)
                .year(b.getYear())
                .totalAllocated(b.getTotalAllocated())
                .usedLeaves(b.getUsedLeaves())
                .remainingLeaves(b.getRemainingLeaves())
                .build();
    }

    public LeaveRequestOut mapToRequestOut(LeaveRequest r) {
        List<LeaveApprovalHistoryOut> historyList = leaveApprovalHistoryRepository.findByLeaveRequestLeaveIdOrderByActionAtAsc(r.getLeaveId())
                .stream().map(h -> LeaveApprovalHistoryOut.builder()
                        .action(h.getAction())
                        .actionByPublicId(h.getActionBy() != null ? h.getActionBy().getPublicId().toString() : null)
                        .actionByName(h.getActionBy() != null ? h.getActionBy().getFullName() : null)
                        .actionAt(h.getActionAt() != null ? h.getActionAt().toString() : null)
                        .remarks(h.getRemarks())
                        .build())
                .collect(Collectors.toList());

        return LeaveRequestOut.builder()
                .publicId(r.getPublicId().toString())
                .employeePublicId(r.getEmployee() != null ? r.getEmployee().getPublicId().toString() : null)
                .employeeName(r.getEmployee() != null ? r.getEmployee().getFullName() : null)
                .leaveTypePublicId(r.getLeaveType() != null ? r.getLeaveType().getPublicId().toString() : null)
                .leaveTypeName(r.getLeaveType() != null ? r.getLeaveType().getName() : null)
                .startDate(r.getStartDate() != null ? r.getStartDate().toString() : "")
                .endDate(r.getEndDate() != null ? r.getEndDate().toString() : "")
                .totalDays(r.getTotalDays())
                .reason(r.getReason())
                .status(r.getStatus())
                .approvedByPublicId(r.getApprovedBy() != null ? r.getApprovedBy().getPublicId().toString() : null)
                .rejectionReason(r.getRejectionReason())
                .history(historyList)
                .build();
    }
}
