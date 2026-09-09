package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class PayrollService {

    @Autowired
    private SalaryRepository salaryRepository;

    @Autowired
    private SalaryComponentRepository salaryComponentRepository;

    @Autowired
    private BankDetailRepository bankDetailRepository;

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AttendanceRepository attendanceRepository;

    public SalaryOut createSalaryStructure(SalaryCreateIn payload) {
        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        // Auto expire previous active revision
        Optional<Salary> previousOpt = salaryRepository.findFirstByEmployeeEmpIdAndEffectiveToIsNullOrderByEffectiveFromDesc(employee.getEmpId());
        if (previousOpt.isPresent()) {
            Salary prev = previousOpt.get();
            prev.setEffectiveTo(payload.getEffectiveFrom().minusDays(1));
            salaryRepository.save(prev);
        }

        BigDecimal netSalary = payload.getBasicSalary();
        if (payload.getComponents() != null) {
            for (SalaryComponentIn comp : payload.getComponents()) {
                if ("earning".equalsIgnoreCase(comp.getComponentType())) {
                    netSalary = netSalary.add(comp.getAmount());
                } else if ("deduction".equalsIgnoreCase(comp.getComponentType())) {
                    netSalary = netSalary.subtract(comp.getAmount());
                }
            }
        }

        Salary salary = Salary.builder()
                .employee(employee)
                .basicSalary(payload.getBasicSalary())
                .netSalary(netSalary)
                .currency(payload.getCurrency() != null ? payload.getCurrency() : "INR")
                .effectiveFrom(payload.getEffectiveFrom())
                .effectiveTo(null)
                .build();

        salary = salaryRepository.save(salary);

        if (payload.getComponents() != null) {
            for (SalaryComponentIn comp : payload.getComponents()) {
                SalaryComponent component = SalaryComponent.builder()
                        .salary(salary)
                        .componentName(comp.getComponentName())
                        .componentType(comp.getComponentType())
                        .amount(comp.getAmount())
                        .build();
                salaryComponentRepository.save(component);
            }
        }

        return mapToSalaryOut(salary);
    }

    @Transactional(readOnly = true)
    public SalaryHistoryOut getEmployeeSalaryHistory(UUID employeePublicId) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        List<Salary> all = salaryRepository.findByEmployeeEmpIdOrderByEffectiveFromDesc(employee.getEmpId());
        SalaryOut active = null;
        List<SalaryOut> history = new ArrayList<>();

        for (Salary s : all) {
            SalaryOut dto = mapToSalaryOut(s);
            if (s.getEffectiveTo() == null && active == null) {
                active = dto;
            } else {
                history.add(dto);
            }
        }

        return SalaryHistoryOut.builder()
                .employeePublicId(employeePublicId.toString())
                .employeeName(employee.getFullName())
                .employeeCode(employee.getEmployeeCode())
                .activeSalary(active)
                .history(history)
                .build();
    }

    @Transactional(readOnly = true)
    public List<SalaryOut> getAllActiveSalaries() {
        List<Salary> activeSalaries = salaryRepository.findAllActiveSalariesWithDetails();
        return activeSalaries.stream()
                .map(this::mapToSalaryOut)
                .collect(Collectors.toList());
    }

    public BankDetailOut addBankDetail(BankDetailIn payload) {
        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        if (Boolean.TRUE.equals(payload.getIsPrimary())) {
            List<BankDetail> existing = bankDetailRepository.findByEmployeeEmpId(employee.getEmpId());
            for (BankDetail b : existing) {
                if (Boolean.TRUE.equals(b.getIsPrimary())) {
                    b.setIsPrimary(false);
                    bankDetailRepository.save(b);
                }
            }
        }

        BankDetail bankDetail = BankDetail.builder()
                .employee(employee)
                .bankName(payload.getBankName())
                .branchName(payload.getBranchName())
                .accountNumber(payload.getAccountNumber())
                .routingCode(payload.getRoutingCode())
                .accountType(payload.getAccountType() != null ? payload.getAccountType() : "savings")
                .isPrimary(payload.getIsPrimary() != null ? payload.getIsPrimary() : true)
                .build();

        bankDetail = bankDetailRepository.save(bankDetail);
        return mapToBankDetailOut(bankDetail);
    }

    @Transactional(readOnly = true)
    public List<BankDetailOut> getEmployeeBankDetails(UUID employeePublicId) {
        Employee employee = employeeRepository.findByPublicId(employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        return bankDetailRepository.findByEmployeeEmpId(employee.getEmpId()).stream()
                .map(this::mapToBankDetailOut)
                .collect(Collectors.toList());
    }

    public BankDetailOut updateBankDetail(UUID publicId, BankDetailUpdateIn payload) {
        BankDetail bankDetail = bankDetailRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Bank detail not found with public_id " + publicId));

        if (payload.getBankName() != null) bankDetail.setBankName(payload.getBankName());
        if (payload.getBranchName() != null) bankDetail.setBranchName(payload.getBranchName());
        if (payload.getAccountNumber() != null) bankDetail.setAccountNumber(payload.getAccountNumber());
        if (payload.getRoutingCode() != null) bankDetail.setRoutingCode(payload.getRoutingCode());
        if (payload.getAccountType() != null) bankDetail.setAccountType(payload.getAccountType());

        if (Boolean.TRUE.equals(payload.getIsPrimary()) && !Boolean.TRUE.equals(bankDetail.getIsPrimary())) {
            List<BankDetail> existing = bankDetailRepository.findByEmployeeEmpId(bankDetail.getEmployee().getEmpId());
            for (BankDetail b : existing) {
                if (Boolean.TRUE.equals(b.getIsPrimary()) && !b.getBankDetailId().equals(bankDetail.getBankDetailId())) {
                    b.setIsPrimary(false);
                    bankDetailRepository.save(b);
                }
            }
            bankDetail.setIsPrimary(true);
        } else if (payload.getIsPrimary() != null) {
            bankDetail.setIsPrimary(payload.getIsPrimary());
        }

        bankDetail = bankDetailRepository.save(bankDetail);
        return mapToBankDetailOut(bankDetail);
    }

    public void deleteBankDetail(UUID publicId) {
        BankDetail bankDetail = bankDetailRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Bank detail not found with public_id " + publicId));
        bankDetailRepository.delete(bankDetail);
    }

    public PayrollProcessSummary processPayrollBatch(PayrollProcessIn payload) {
        List<Employee> targetEmployees = new ArrayList<>();

        if (payload.getEmployeePublicId() != null && !payload.getEmployeePublicId().isBlank()) {
            Employee emp = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
            targetEmployees.add(emp);
        } else {
            targetEmployees = employeeRepository.findAll().stream()
                    .filter(e -> "active".equalsIgnoreCase(e.getEmployeeStatus()))
                    .collect(Collectors.toList());
        }

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal totalNet = BigDecimal.ZERO;
        List<PayrollRunOut> processedRuns = new ArrayList<>();

        for (Employee emp : targetEmployees) {
            Optional<Salary> salaryOpt = salaryRepository.findFirstByEmployeeEmpIdAndEffectiveToIsNullOrderByEffectiveFromDesc(emp.getEmpId());
            if (salaryOpt.isEmpty()) {
                continue;
            }

            Salary salary = salaryOpt.get();
            List<SalaryComponent> components = salaryComponentRepository.findBySalarySalaryId(salary.getSalaryId());

            BigDecimal gross = salary.getBasicSalary();
            BigDecimal deductions = BigDecimal.ZERO;

            for (SalaryComponent comp : components) {
                if ("earning".equalsIgnoreCase(comp.getComponentType())) {
                    gross = gross.add(comp.getAmount());
                } else if ("deduction".equalsIgnoreCase(comp.getComponentType())) {
                    deductions = deductions.add(comp.getAmount());
                }
            }

            BigDecimal netPaid = gross.subtract(deductions);

            PayrollRun run = PayrollRun.builder()
                    .employee(emp)
                    .salary(salary)
                    .payPeriodStart(payload.getPayPeriodStart())
                    .payPeriodEnd(payload.getPayPeriodEnd())
                    .grossAmount(gross)
                    .totalDeductions(deductions)
                    .netPaid(netPaid)
                    .paymentDate(payload.getPaymentDate())
                    .paymentStatus("pending")
                    .paymentMethod(payload.getPaymentMethod() != null ? payload.getPaymentMethod() : "bank_transfer")
                    .build();

            run = payrollRunRepository.save(run);
            processedRuns.add(mapToPayrollRunOut(run));

            totalGross = totalGross.add(gross);
            totalDeductions = totalDeductions.add(deductions);
            totalNet = totalNet.add(netPaid);
        }

        return PayrollProcessSummary.builder()
                .totalEmployeesProcessed(processedRuns.size())
                .totalGrossDisbursed(totalGross)
                .totalDeductions(totalDeductions)
                .totalNetDisbursed(totalNet)
                .processedRuns(processedRuns)
                .build();
    }

    @Transactional(readOnly = true)
    public PaginatedPayrollRuns getPayrollRunsPaginated(
            int skip, Integer limit,
            String employeePublicId, String paymentStatus,
            LocalDate payPeriodStart, LocalDate payPeriodEnd
    ) {
        Specification<PayrollRun> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (employeePublicId != null && !employeePublicId.isBlank()) {
                predicates.add(cb.equal(root.get("employee").get("publicId"), UUID.fromString(employeePublicId)));
            }
            if (paymentStatus != null && !paymentStatus.isBlank()) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus));
            }
            if (payPeriodStart != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("payPeriodStart"), payPeriodStart));
            }
            if (payPeriodEnd != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("payPeriodEnd"), payPeriodEnd));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        Pageable pageable = PageRequest.of(pageNumber, pageSize);

        Page<PayrollRun> page = payrollRunRepository.findAll(spec, pageable);

        List<PayrollRunOut> items = page.getContent().stream()
                .map(this::mapToPayrollRunOut)
                .collect(Collectors.toList());

        return PaginatedPayrollRuns.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public PayslipOut getPayslipDetail(UUID payrollPublicId) {
        PayrollRun run = payrollRunRepository.findByPublicId(payrollPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Payroll run not found with public_id " + payrollPublicId));

        Employee emp = run.getEmployee();
        Salary salary = run.getSalary();

        List<SalaryComponentOut> earnings = new ArrayList<>();
        List<SalaryComponentOut> deductions = new ArrayList<>();

        if (salary != null) {
            List<SalaryComponent> components = salaryComponentRepository.findBySalarySalaryId(salary.getSalaryId());
            for (SalaryComponent c : components) {
                SalaryComponentOut compOut = SalaryComponentOut.builder()
                        .componentName(c.getComponentName())
                        .componentType(c.getComponentType())
                        .amount(c.getAmount())
                        .build();

                if ("earning".equalsIgnoreCase(c.getComponentType())) {
                    earnings.add(compOut);
                } else {
                    deductions.add(compOut);
                }
            }
        }

        Optional<BankDetail> bankOpt = bankDetailRepository.findByEmployeeEmpIdAndIsPrimaryTrue(emp.getEmpId());
        String bankName = bankOpt.map(BankDetail::getBankName).orElse(null);
        String accountNumber = bankOpt.map(BankDetail::getAccountNumber).orElse(null);

        int daysInPeriod = (int) ChronoUnit.DAYS.between(run.getPayPeriodStart(), run.getPayPeriodEnd()) + 1;
        List<Attendance> attRecords = attendanceRepository.findByEmployeeAndDateRange(
                emp.getEmpId(), run.getPayPeriodStart(), run.getPayPeriodEnd()
        );
        int daysPresent = (int) attRecords.stream().filter(a -> "present".equalsIgnoreCase(a.getStatus())).count();
        int daysHalfDay = (int) attRecords.stream().filter(a -> "half_day".equalsIgnoreCase(a.getStatus())).count();
        int daysOnLeave = (int) attRecords.stream().filter(a -> "on_leave".equalsIgnoreCase(a.getStatus())).count();
        int daysAbsent = (int) attRecords.stream().filter(a -> "absent".equalsIgnoreCase(a.getStatus())).count();

        return PayslipOut.builder()
                .payrollPublicId(run.getPublicId().toString())
                .employeePublicId(emp.getPublicId().toString())
                .employeeName(emp.getFullName())
                .employeeCode(emp.getEmployeeCode())
                .email(emp.getEmail())
                .department(emp.getDepartment() != null ? emp.getDepartment().getDeptName() : null)
                .designation(emp.getDesignation() != null ? emp.getDesignation().getTitle() : null)
                .bankAccountMasked(accountNumber != null && accountNumber.length() > 4 ? "XXXX-XXXX-" + accountNumber.substring(accountNumber.length() - 4) : accountNumber)
                .bankName(bankName)
                .payPeriodStart(run.getPayPeriodStart().toString())
                .payPeriodEnd(run.getPayPeriodEnd().toString())
                .daysInPeriod(daysInPeriod)
                .daysPresent(daysPresent)
                .daysHalfDay(daysHalfDay)
                .daysOnLeave(daysOnLeave)
                .daysAbsent(daysAbsent)
                .basicSalary(salary != null ? salary.getBasicSalary() : BigDecimal.ZERO)
                .earningsBreakdown(earnings)
                .deductionsBreakdown(deductions)
                .grossAmount(run.getGrossAmount())
                .totalDeductions(run.getTotalDeductions())
                .netPaid(run.getNetPaid())
                .paymentStatus(run.getPaymentStatus())
                .paymentDate(run.getPaymentDate() != null ? run.getPaymentDate().toString() : null)
                .paymentMethod(run.getPaymentMethod())
                .transactionRef(run.getTransactionRef())
                .build();
    }

    public PayrollRunOut disbursePayrollRun(UUID payrollPublicId, PayrollDisburseIn payload) {
        PayrollRun run = payrollRunRepository.findByPublicId(payrollPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Payroll run not found"));

        run.setPaymentStatus("paid");
        run.setPaymentMethod(payload.getPaymentMethod());
        run.setPaymentDate(payload.getPaymentDate());

        String ref = payload.getTransactionRef();
        if (ref == null || ref.isBlank()) {
            ref = "TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
        run.setTransactionRef(ref);

        run = payrollRunRepository.save(run);
        return mapToPayrollRunOut(run);
    }

    public SalaryOut updateSalary(UUID publicId, SalaryCreateIn payload) {
        Salary salary = salaryRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary revision not found with public_id " + publicId));

        if (payload.getBasicSalary() != null) {
            salary.setBasicSalary(payload.getBasicSalary());
        }
        if (payload.getCurrency() != null) {
            salary.setCurrency(payload.getCurrency());
        }
        if (payload.getEffectiveFrom() != null) {
            salary.setEffectiveFrom(payload.getEffectiveFrom());
        }

        BigDecimal netSalary = salary.getBasicSalary();
        if (payload.getComponents() != null) {
            // Remove old components
            List<SalaryComponent> oldComponents = salaryComponentRepository.findBySalarySalaryId(salary.getSalaryId());
            salaryComponentRepository.deleteAll(oldComponents);

            for (SalaryComponentIn comp : payload.getComponents()) {
                if ("earning".equalsIgnoreCase(comp.getComponentType())) {
                    netSalary = netSalary.add(comp.getAmount());
                } else if ("deduction".equalsIgnoreCase(comp.getComponentType())) {
                    netSalary = netSalary.subtract(comp.getAmount());
                }
                SalaryComponent component = SalaryComponent.builder()
                        .salary(salary)
                        .componentName(comp.getComponentName())
                        .componentType(comp.getComponentType())
                        .amount(comp.getAmount())
                        .build();
                salaryComponentRepository.save(component);
            }
        }
        salary.setNetSalary(netSalary);
        salary = salaryRepository.save(salary);
        return mapToSalaryOut(salary);
    }

    public void deleteSalary(UUID publicId) {
        Salary salary = salaryRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary revision not found with public_id " + publicId));
        salaryRepository.delete(salary);
    }

    public void deletePayrollRun(UUID payrollPublicId) {
        PayrollRun run = payrollRunRepository.findByPublicId(payrollPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Payroll run not found with public_id " + payrollPublicId));
        if ("paid".equalsIgnoreCase(run.getPaymentStatus())) {
            throw new com.datansh.EmployeeManagment.exception.BadRequestException("Cannot delete a disbursed/paid payroll run");
        }
        payrollRunRepository.delete(run);
    }

    public SalaryOut mapToSalaryOut(Salary s) {
        List<SalaryComponentOut> components = (s.getComponents() != null && !s.getComponents().isEmpty())
                ? s.getComponents().stream()
                        .map(c -> SalaryComponentOut.builder()
                                .componentName(c.getComponentName())
                                .componentType(c.getComponentType())
                                .amount(c.getAmount())
                                .build())
                        .collect(Collectors.toList())
                : salaryComponentRepository.findBySalarySalaryId(s.getSalaryId()).stream()
                        .map(c -> SalaryComponentOut.builder()
                                .componentName(c.getComponentName())
                                .componentType(c.getComponentType())
                                .amount(c.getAmount())
                                .build())
                        .collect(Collectors.toList());

        Employee emp = s.getEmployee();
        String empName = emp != null ? emp.getFullName() : null;
        String empCode = emp != null ? emp.getEmployeeCode() : null;
        String deptName = (emp != null && emp.getDepartment() != null) ? emp.getDepartment().getDeptName() : null;

        return SalaryOut.builder()
                .publicId(s.getPublicId().toString())
                .employeePublicId(emp != null ? emp.getPublicId().toString() : null)
                .employeeName(empName)
                .employeeCode(empCode)
                .departmentName(deptName)
                .basicSalary(s.getBasicSalary())
                .netSalary(s.getNetSalary())
                .currency(s.getCurrency())
                .effectiveFrom(s.getEffectiveFrom() != null ? s.getEffectiveFrom().toString() : null)
                .effectiveTo(s.getEffectiveTo() != null ? s.getEffectiveTo().toString() : null)
                .components(components)
                .build();
    }

    public BankDetailOut mapToBankDetailOut(BankDetail b) {
        return BankDetailOut.builder()
                .publicId(b.getPublicId().toString())
                .employeePublicId(b.getEmployee() != null ? b.getEmployee().getPublicId().toString() : null)
                .bankName(b.getBankName())
                .branchName(b.getBranchName())
                .accountNumber(b.getAccountNumber())
                .routingCode(b.getRoutingCode())
                .accountType(b.getAccountType())
                .isPrimary(b.getIsPrimary())
                .build();
    }

    public PayrollRunOut mapToPayrollRunOut(PayrollRun r) {
        Employee emp = r.getEmployee();
        return PayrollRunOut.builder()
                .publicId(r.getPublicId().toString())
                .employeePublicId(emp != null ? emp.getPublicId().toString() : null)
                .employeeName(emp != null ? emp.getFullName() : "")
                .employeeCode(emp != null ? emp.getEmployeeCode() : "")
                .departmentName(emp != null && emp.getDepartment() != null ? emp.getDepartment().getDeptName() : null)
                .designationTitle(emp != null && emp.getDesignation() != null ? emp.getDesignation().getTitle() : null)
                .salaryPublicId(r.getSalary() != null ? r.getSalary().getPublicId().toString() : null)
                .payPeriodStart(r.getPayPeriodStart() != null ? r.getPayPeriodStart().toString() : "")
                .payPeriodEnd(r.getPayPeriodEnd() != null ? r.getPayPeriodEnd().toString() : "")
                .grossAmount(r.getGrossAmount())
                .totalDeductions(r.getTotalDeductions())
                .netPaid(r.getNetPaid())
                .paymentDate(r.getPaymentDate() != null ? r.getPaymentDate().toString() : null)
                .paymentStatus(r.getPaymentStatus())
                .paymentMethod(r.getPaymentMethod())
                .transactionRef(r.getTransactionRef())
                .build();
    }
}
