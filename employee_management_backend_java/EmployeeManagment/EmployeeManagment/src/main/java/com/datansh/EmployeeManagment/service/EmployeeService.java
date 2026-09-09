package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class EmployeeService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private DesignationRepository designationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AddressService addressService;

    @Autowired
    private SalaryRepository salaryRepository;

    @Autowired
    private SalaryComponentRepository salaryComponentRepository;

    @Autowired
    private BankDetailRepository bankDetailRepository;

    @Transactional(readOnly = true)
    public PaginatedEmployees searchEmployees(
            String publicId, String email, String employeeCode, String reportingManagerPublicId,
            String firstName, String lastName, String departmentPublicId, String designationPublicId,
            String employeeStatus, String employmentType, String gender,
            LocalDate minJoiningDate, LocalDate maxJoiningDate,
            int skip, Integer limit
    ) {
        Specification<Employee> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (publicId != null && !publicId.isBlank()) {
                predicates.add(cb.equal(root.get("publicId"), UUID.fromString(publicId)));
            }
            if (email != null && !email.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("email")), email.toLowerCase()));
            }
            if (employeeCode != null && !employeeCode.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("employeeCode")), employeeCode.toLowerCase()));
            }
            if (reportingManagerPublicId != null && !reportingManagerPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("reportingManager").get("publicId"), UUID.fromString(reportingManagerPublicId)));
            }
            if (firstName != null && !firstName.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("firstName")), "%" + firstName.toLowerCase() + "%"));
            }
            if (lastName != null && !lastName.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("lastName")), "%" + lastName.toLowerCase() + "%"));
            }
            if (departmentPublicId != null && !departmentPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("department").get("publicId"), UUID.fromString(departmentPublicId)));
            }
            if (designationPublicId != null && !designationPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("designation").get("publicId"), UUID.fromString(designationPublicId)));
            }
            if (employeeStatus != null && !employeeStatus.isBlank()) {
                predicates.add(cb.equal(root.get("employeeStatus"), employeeStatus));
            }
            if (employmentType != null && !employmentType.isBlank()) {
                predicates.add(cb.equal(root.get("employmentType"), employmentType));
            }
            if (gender != null && !gender.isBlank()) {
                predicates.add(cb.equal(root.get("gender"), gender));
            }
            if (minJoiningDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("joiningDate"), minJoiningDate));
            }
            if (maxJoiningDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("joiningDate"), maxJoiningDate));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        Pageable pageable = PageRequest.of(pageNumber, pageSize);

        Page<Employee> page = employeeRepository.findAll(spec, pageable);

        List<EmployeeOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return PaginatedEmployees.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public EmployeeFullProfileOut getMyFullProfile(User currentUser) {
        Optional<Employee> empOpt = employeeRepository.findByUserUserId(currentUser.getUserId());
        if (empOpt.isEmpty()) {
            throw new ResourceNotFoundException("No employee profile found for current user. Please complete onboarding first.");
        }
        return getEmployeeFullProfile(empOpt.get().getPublicId());
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "employee_profiles", key = "#publicId.toString()")
    public EmployeeFullProfileOut getEmployeeFullProfile(UUID publicId) {
        Employee employee = employeeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + publicId + "' not found"));

        EmployeeOut base = mapToDto(employee);
        List<AddressOut> addresses = addressService.getAddresses(publicId);
        List<EmergencyContactOut> emergencyContacts = addressService.getEmergencyContacts(publicId);

        SalaryOut currentSalary = null;
        Optional<Salary> salaryOpt = salaryRepository.findFirstByEmployeePublicIdAndEffectiveToIsNullOrderByEffectiveFromDesc(publicId);
        if (salaryOpt.isPresent()) {
            Salary s = salaryOpt.get();
            currentSalary = mapToSalaryOut(s);
        }

        BankDetailOut primaryBankDetail = null;
        Optional<BankDetail> bankOpt = bankDetailRepository.findByEmployeePublicIdAndIsPrimaryTrue(publicId);
        if (bankOpt.isPresent()) {
            BankDetail b = bankOpt.get();
            primaryBankDetail = BankDetailOut.builder()
                    .publicId(b.getPublicId().toString())
                    .employeePublicId(publicId.toString())
                    .bankName(b.getBankName())
                    .branchName(b.getBranchName())
                    .accountNumber(b.getAccountNumber())
                    .routingCode(b.getRoutingCode())
                    .accountType(b.getAccountType())
                    .isPrimary(b.getIsPrimary())
                    .build();
        }

        return EmployeeFullProfileOut.builder()
                .publicId(base.getPublicId())
                .employeeCode(base.getEmployeeCode())
                .firstName(base.getFirstName())
                .lastName(base.getLastName())
                .dateOfBirth(base.getDateOfBirth())
                .gender(base.getGender())
                .email(base.getEmail())
                .phone(base.getPhone())
                .secondaryEmail(employee.getUser() != null ? employee.getUser().getSecondaryEmail() : null)
                .joiningDate(base.getJoiningDate())
                .employeeStatus(base.getEmployeeStatus())
                .employmentType(base.getEmploymentType())
                .departmentPublicId(base.getDepartmentPublicId())
                .departmentName(base.getDepartmentName())
                .designationPublicId(base.getDesignationPublicId())
                .designationName(base.getDesignationName())
                .reportingManagerPublicId(base.getReportingManagerPublicId())
                .isActive(base.getIsActive())
                .timezone(base.getTimezone())
                .addresses(addresses)
                .emergencyContacts(emergencyContacts)
                .currentSalary(currentSalary)
                .primaryBankDetail(primaryBankDetail)
                .build();
    }

    @Caching(evict = {
            @CacheEvict(value = "employee_profiles", allEntries = true),
            @CacheEvict(value = "employee_lists", allEntries = true)
    })
    public EmployeeFullProfileOut updateMyProfile(User currentUser, EmployeeProfileIn payload) {
        Employee employee = employeeRepository.findByUserUserId(currentUser.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("No employee profile found for user"));

        if (payload.getFirstName() != null) employee.setFirstName(payload.getFirstName());
        if (payload.getLastName() != null) employee.setLastName(payload.getLastName());
        if (payload.getDateOfBirth() != null) employee.setDateOfBirth(payload.getDateOfBirth());
        if (payload.getGender() != null) employee.setGender(payload.getGender());
        if (payload.getPhone() != null) employee.setPhone(payload.getPhone());
        if (payload.getTimezone() != null) employee.setTimezone(payload.getTimezone());

        employeeRepository.save(employee);

        if (payload.getAddresses() != null) {
            for (AddressIn addrIn : payload.getAddresses()) {
                addressService.addAddress(employee.getPublicId(), addrIn);
            }
        }

        if (payload.getEmergencyContacts() != null) {
            for (EmergencyContactIn ecIn : payload.getEmergencyContacts()) {
                addressService.addEmergencyContact(employee.getPublicId(), ecIn);
            }
        }

        return getEmployeeFullProfile(employee.getPublicId());
    }

    @Caching(evict = {
            @CacheEvict(value = "employee_lists", allEntries = true)
    })
    public EmployeeOut createEmployee(EmployeeIn payload) {
        String email = payload.getEmail().trim().toLowerCase();
        if (employeeRepository.existsByEmail(email)) {
            throw new BadRequestException("Employee with email '" + email + "' already exists");
        }

        String code = payload.getEmployeeCode();
        if (code != null && !code.isBlank()) {
            if (employeeRepository.existsByEmployeeCode(code.trim())) {
                throw new BadRequestException("Employee code '" + code + "' is already in use");
            }
            code = code.trim();
        } else {
            long count = employeeRepository.count() + 1;
            code = String.format("EMP-%04d", count);
            while (employeeRepository.existsByEmployeeCode(code)) {
                count++;
                code = String.format("EMP-%04d", count);
            }
        }

        Department dept = null;
        if (payload.getDepartmentPublicId() != null && !payload.getDepartmentPublicId().isBlank()) {
            dept = departmentRepository.findByPublicId(UUID.fromString(payload.getDepartmentPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Department with public_id '" + payload.getDepartmentPublicId() + "' not found"));
        }

        Designation desig = null;
        if (payload.getDesignationPublicId() != null && !payload.getDesignationPublicId().isBlank()) {
            desig = designationRepository.findByPublicId(UUID.fromString(payload.getDesignationPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Designation with public_id '" + payload.getDesignationPublicId() + "' not found"));
        }

        Employee manager = null;
        if (payload.getReportingManagerPublicId() != null && !payload.getReportingManagerPublicId().isBlank()) {
            manager = employeeRepository.findByPublicId(UUID.fromString(payload.getReportingManagerPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Reporting manager with public_id '" + payload.getReportingManagerPublicId() + "' not found"));
        }

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = User.builder()
                    .email(email)
                    .displayName(payload.getFirstName().trim() + " " + payload.getLastName().trim())
                    .passwordHash("$2a$10$wN9i07P8sXg.5r9XfM3Z4e1X9uW6kQxO3wL3v5n1b7a2d4c6e8g0")
                    .isActive(true)
                    .build();
            return userRepository.save(newUser);
        });

        Employee emp = Employee.builder()
                .user(user)
                .firstName(payload.getFirstName().trim())
                .lastName(payload.getLastName().trim())
                .email(email)
                .phone(payload.getPhone() != null ? payload.getPhone().trim() : null)
                .dateOfBirth(payload.getDateOfBirth())
                .gender(payload.getGender() != null ? payload.getGender().trim().toLowerCase() : "male")
                .joiningDate(payload.getJoiningDate() != null ? payload.getJoiningDate() : LocalDate.now())
                .employeeStatus(payload.getEmployeeStatus() != null ? payload.getEmployeeStatus().trim().toLowerCase() : "active")
                .employmentType(payload.getEmploymentType() != null ? payload.getEmploymentType().trim().toLowerCase() : "full_time")
                .department(dept)
                .designation(desig)
                .reportingManager(manager)
                .employeeCode(code)
                .isActive(payload.getIsActive() != null ? payload.getIsActive() : true)
                .timezone(payload.getTimezone() != null ? payload.getTimezone() : "UTC")
                .build();

        emp = employeeRepository.save(emp);
        return mapToDto(emp);
    }

    @Caching(evict = {
            @CacheEvict(value = "employee_profiles", key = "#publicId.toString()"),
            @CacheEvict(value = "employee_lists", allEntries = true)
    })
    public EmployeeFullProfileOut adminSetupEmployee(UUID publicId, AdminEmployeeSetupIn payload) {
        Employee employee = employeeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + publicId + "' not found"));

        if (payload.getEmployeeCode() != null && !payload.getEmployeeCode().isBlank()) {
            if (!payload.getEmployeeCode().equalsIgnoreCase(employee.getEmployeeCode()) &&
                    employeeRepository.existsByEmployeeCode(payload.getEmployeeCode())) {
                throw new BadRequestException("Employee code '" + payload.getEmployeeCode() + "' is already in use");
            }
            employee.setEmployeeCode(payload.getEmployeeCode());
        }

        if (payload.getFirstName() != null) employee.setFirstName(payload.getFirstName());
        if (payload.getLastName() != null) employee.setLastName(payload.getLastName());
        if (payload.getDateOfBirth() != null) employee.setDateOfBirth(payload.getDateOfBirth());
        if (payload.getGender() != null) employee.setGender(payload.getGender());
        if (payload.getPhone() != null) employee.setPhone(payload.getPhone());
        if (payload.getJoiningDate() != null) employee.setJoiningDate(payload.getJoiningDate());
        if (payload.getEmployeeStatus() != null) employee.setEmployeeStatus(payload.getEmployeeStatus());
        if (payload.getEmploymentType() != null) employee.setEmploymentType(payload.getEmploymentType());
        if (payload.getTimezone() != null) employee.setTimezone(payload.getTimezone());

        if (payload.getDepartmentPublicId() != null && !payload.getDepartmentPublicId().isBlank()) {
            Department dept = departmentRepository.findByPublicId(UUID.fromString(payload.getDepartmentPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
            employee.setDepartment(dept);
        }

        if (payload.getDesignationPublicId() != null && !payload.getDesignationPublicId().isBlank()) {
            Designation des = designationRepository.findByPublicId(UUID.fromString(payload.getDesignationPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Designation not found"));
            employee.setDesignation(des);
        }

        if (payload.getReportingManagerPublicId() != null && !payload.getReportingManagerPublicId().isBlank()) {
            Employee manager = employeeRepository.findByPublicId(UUID.fromString(payload.getReportingManagerPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Reporting manager not found"));
            employee.setReportingManager(manager);
        }

        employeeRepository.save(employee);

        // Addresses
        if (payload.getAddresses() != null) {
            for (AddressIn addrIn : payload.getAddresses()) {
                addressService.addAddress(employee.getPublicId(), addrIn);
            }
        }

        // Emergency contacts
        if (payload.getEmergencyContacts() != null) {
            for (EmergencyContactIn ecIn : payload.getEmergencyContacts()) {
                addressService.addEmergencyContact(employee.getPublicId(), ecIn);
            }
        }

        // Bank Detail
        if (payload.getBankDetail() != null) {
            BankDetailIn bIn = payload.getBankDetail();
            BankDetail bankDetail = BankDetail.builder()
                    .employee(employee)
                    .bankName(bIn.getBankName())
                    .branchName(bIn.getBranchName())
                    .accountNumber(bIn.getAccountNumber())
                    .routingCode(bIn.getRoutingCode())
                    .accountType(bIn.getAccountType() != null ? bIn.getAccountType() : "savings")
                    .isPrimary(bIn.getIsPrimary() != null ? bIn.getIsPrimary() : true)
                    .build();
            bankDetailRepository.save(bankDetail);
        }

        // Salary Structure
        if (payload.getSalary() != null) {
            SalaryCreateIn sIn = payload.getSalary();
            createSalaryRevisionInternal(employee, sIn);
        }

        return getEmployeeFullProfile(employee.getPublicId());
    }

    @Caching(evict = {
            @CacheEvict(value = "employee_profiles", key = "#publicId.toString()"),
            @CacheEvict(value = "employee_lists", allEntries = true)
    })
    public EmployeeOut updateEmployee(UUID publicId, EmployeeIn payload) {
        Employee employee = employeeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + publicId + "' not found"));

        if (payload.getFirstName() != null) employee.setFirstName(payload.getFirstName());
        if (payload.getLastName() != null) employee.setLastName(payload.getLastName());
        if (payload.getDateOfBirth() != null) employee.setDateOfBirth(payload.getDateOfBirth());
        if (payload.getGender() != null) employee.setGender(payload.getGender());
        if (payload.getPhone() != null) employee.setPhone(payload.getPhone());
        if (payload.getJoiningDate() != null) employee.setJoiningDate(payload.getJoiningDate());
        if (payload.getEmployeeStatus() != null) employee.setEmployeeStatus(payload.getEmployeeStatus());
        if (payload.getEmploymentType() != null) employee.setEmploymentType(payload.getEmploymentType());
        if (payload.getIsActive() != null) employee.setIsActive(payload.getIsActive());
        if (payload.getTimezone() != null) employee.setTimezone(payload.getTimezone());

        if (payload.getDepartmentPublicId() != null && !payload.getDepartmentPublicId().isBlank()) {
            Department dept = departmentRepository.findByPublicId(UUID.fromString(payload.getDepartmentPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
            employee.setDepartment(dept);
        }

        if (payload.getDesignationPublicId() != null && !payload.getDesignationPublicId().isBlank()) {
            Designation des = designationRepository.findByPublicId(UUID.fromString(payload.getDesignationPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Designation not found"));
            employee.setDesignation(des);
        }

        if (payload.getReportingManagerPublicId() != null && !payload.getReportingManagerPublicId().isBlank()) {
            Employee manager = employeeRepository.findByPublicId(UUID.fromString(payload.getReportingManagerPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Reporting manager not found"));
            employee.setReportingManager(manager);
        }

        employee = employeeRepository.save(employee);
        return mapToDto(employee);
    }

    @Caching(evict = {
            @CacheEvict(value = "employee_profiles", key = "#publicId.toString()"),
            @CacheEvict(value = "employee_lists", allEntries = true)
    })
    public void deleteEmployee(UUID publicId) {
        Employee employee = employeeRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee with public_id '" + publicId + "' not found"));

        employee.setEmployeeStatus("terminated");
        employee.setIsActive(false);
        employeeRepository.save(employee);
    }

    private void createSalaryRevisionInternal(Employee employee, SalaryCreateIn payload) {
        // Expire previous active salary revision to avoid date conflicts
        Optional<Salary> previousSalary = salaryRepository.findFirstByEmployeeEmpIdAndEffectiveToIsNullOrderByEffectiveFromDesc(employee.getEmpId());
        if (previousSalary.isPresent()) {
            Salary prev = previousSalary.get();
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
    }

    public SalaryOut mapToSalaryOut(Salary s) {
        List<SalaryComponentOut> components = salaryComponentRepository.findBySalarySalaryId(s.getSalaryId()).stream()
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

    public EmployeeOut mapToDto(Employee emp) {
        return EmployeeOut.builder()
                .publicId(emp.getPublicId().toString())
                .employeeCode(emp.getEmployeeCode())
                .firstName(emp.getFirstName())
                .lastName(emp.getLastName())
                .dateOfBirth(emp.getDateOfBirth())
                .gender(emp.getGender())
                .email(emp.getEmail())
                .phone(emp.getPhone())
                .joiningDate(emp.getJoiningDate())
                .employeeStatus(emp.getEmployeeStatus())
                .employmentType(emp.getEmploymentType())
                .departmentPublicId(emp.getDepartment() != null ? emp.getDepartment().getPublicId().toString() : null)
                .departmentName(emp.getDepartment() != null ? emp.getDepartment().getDeptName() : null)
                .designationPublicId(emp.getDesignation() != null ? emp.getDesignation().getPublicId().toString() : null)
                .designationName(emp.getDesignation() != null ? emp.getDesignation().getTitle() : null)
                .reportingManagerPublicId(emp.getReportingManager() != null ? emp.getReportingManager().getPublicId().toString() : null)
                .isActive(emp.getIsActive())
                .timezone(emp.getTimezone())
                .build();
    }
}
