package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "employees", indexes = {
    @Index(name = "idx_employees_public_id", columnList = "public_id"),
    @Index(name = "idx_employees_employee_code", columnList = "employee_code"),
    @Index(name = "idx_employees_email", columnList = "email"),
    @Index(name = "idx_employees_dept", columnList = "dept_id"),
    @Index(name = "idx_employees_designation", columnList = "designation_id"),
    @Index(name = "idx_employees_manager", columnList = "reporting_manager_id"),
    @Index(name = "idx_employees_status", columnList = "employee_status"),
    @Index(name = "idx_employees_is_active", columnList = "is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emp_id")
    private Long empId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @Column(name = "employee_code", nullable = false, unique = true, length = 20)
    private String employeeCode;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "phone", unique = true, length = 15)
    private String phone;

    @Column(name = "joining_date")
    private LocalDate joiningDate;

    @Column(name = "employee_status", length = 20)
    @Builder.Default
    private String employeeStatus = "active";

    @Column(name = "employment_type", length = 20)
    @Builder.Default
    private String employmentType = "full_time";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designation_id")
    private Designation designation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporting_manager_id")
    private Employee reportingManager;

    @OneToMany(mappedBy = "reportingManager", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Employee> directReports = new ArrayList<>();

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "timezone", length = 50)
    @Builder.Default
    private String timezone = "UTC";

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true, nullable = false)
    private User user;

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<EmployeeAddress> employeeAddresses = new ArrayList<>();

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<EmergencyContact> emergencyContacts = new ArrayList<>();

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Salary> salaries = new ArrayList<>();

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<BankDetail> bankDetails = new ArrayList<>();

    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PayrollRun> payrollRuns = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID();
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.employeeStatus == null) {
            this.employeeStatus = "active";
        }
        if (this.employmentType == null) {
            this.employmentType = "full_time";
        }
        if (this.timezone == null) {
            this.timezone = "UTC";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public String getFullName() {
        return (firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "");
    }
}
