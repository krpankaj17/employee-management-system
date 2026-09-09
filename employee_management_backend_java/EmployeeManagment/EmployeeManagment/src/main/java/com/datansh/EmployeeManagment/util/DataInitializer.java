package com.datansh.EmployeeManagment.util;

import com.datansh.EmployeeManagment.entity.*;
import com.datansh.EmployeeManagment.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private DesignationRepository designationRepository;

    @Autowired
    private AddressRepository addressRepository;

    @Autowired
    private EmployeeAddressRepository employeeAddressRepository;

    @Autowired
    private EmergencyContactRepository emergencyContactRepository;

    @Autowired
    private SalaryRepository salaryRepository;

    @Autowired
    private SalaryComponentRepository salaryComponentRepository;

    @Autowired
    private BankDetailRepository bankDetailRepository;

    @Autowired
    private LeaveTypeRepository leaveTypeRepository;

    @Autowired
    private EmployeeLeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Checking and seeding employee records...");
        seedEmployees();
        log.info("Database employee verification completed.");
    }

    private void seedEmployees() {
        // Corporate seed employees matching Python src/utils/seed_data.py
        Object[][] employeesData = {
                // code, firstName, lastName, email, phone, dob, joiningDate, gender, deptCode, desigTitle, roleName, basicSalary, city, state, address, pincode, contactName, contactRel, contactPhone
                {"EMP-2001", "Vikramaditya", "Rao", "vikram.rao@company.com", "+919820010001", "1980-05-14", "2016-02-01", "male", "DEPT-1", "Chief Technology Officer", "Department_Head", "350000.00", "Bengaluru", "Karnataka", "Penthouse 12, Indiranagar 100ft Road", "560038", "Radhika Rao", "Spouse", "+919820090001"},
                {"EMP-2002", "Priyadarshini", "Sundaram", "priya.sundaram@company.com", "+919820010002", "1982-08-20", "2017-04-15", "female", "DEPT-1", "Vice President", "Department_Head", "300000.00", "Bengaluru", "Karnataka", "Villa 45, Palm Meadows, Whitefield", "560066", "Sundaram Ramakrishnan", "Father", "+919820090002"},
                {"EMP-2003", "Arjun", "Mehta", "arjun.mehta@company.com", "+919820010003", "1985-03-11", "2018-01-10", "male", "DEPT-2", "Director of Engineering", "Department_Head", "240000.00", "Bengaluru", "Karnataka", "Flat 804, Sobha Quartz, Bellandur", "560103", "Neha Mehta", "Spouse", "+919820090003"},
                {"EMP-2004", "Ananya", "Deshmukh", "ananya.deshmukh@company.com", "+919820010004", "1988-11-25", "2019-06-01", "female", "DEPT-2", "Lead Architect", "Project_Manager", "190000.00", "Bengaluru", "Karnataka", "302 Green Glen Layout, Bellandur", "560103", "Vijay Deshmukh", "Father", "+919820090004"},
                {"EMP-2005", "Rohan", "Kulkarni", "rohan.kulkarni@company.com", "+919820010005", "1991-07-19", "2020-09-15", "male", "DEPT-2", "Senior Software Engineer", "Employee", "140000.00", "Bengaluru", "Karnataka", "B-201, Prestige Ferns Residency, HSR Layout", "560102", "Sunita Kulkarni", "Mother", "+919820090005"},
                {"EMP-2006", "Sneha", "Nambiar", "sneha.nambiar@company.com", "+919820010006", "1994-02-08", "2021-08-01", "female", "DEPT-2", "Software Engineer", "Employee", "95000.00", "Bengaluru", "Karnataka", "104, Salarpuria Greenage, Bommanahalli", "560068", "Kishore Nambiar", "Brother", "+919820090006"},
                {"EMP-2007", "Rajesh", "Sharma", "rajesh.sharma@company.com", "+919820010007", "1978-10-05", "2015-08-10", "male", "DEPT-3", "HR Director", "HR_Manager", "260000.00", "Bengaluru", "Karnataka", "A-602, Mantri Espana, Bellandur", "560103", "Sunita Sharma", "Spouse", "+919820090007"},
                {"EMP-2008", "Kavita", "Iyer", "kavita.iyer@company.com", "+919820010008", "1989-04-12", "2019-11-01", "female", "DEPT-3", "Senior HR Generalist", "HR_Manager", "120000.00", "Bengaluru", "Karnataka", "Flat 4B, Purva Riviera, Marathahalli", "560037", "Iyer Narayanan", "Father", "+919820090008"},
                {"EMP-2009", "Siddharth", "Mukherjee", "siddharth.m@company.com", "+919820010009", "1983-09-30", "2017-03-01", "male", "DEPT-4", "Finance Director", "Department_Head", "250000.00", "Bengaluru", "Karnataka", "Villa 12, Adarsh Palm Retreat, Outer Ring Road", "560103", "Ananya Mukherjee", "Spouse", "+919820090009"},
                {"EMP-2010", "Neha", "Gupta", "neha.gupta@company.com", "+919820010010", "1992-06-18", "2021-01-15", "female", "DEPT-4", "Senior Accountant", "Employee", "110000.00", "Bengaluru", "Karnataka", "303, Rohan Jharoka, Yemalur", "560037", "Sanjay Gupta", "Father", "+919820090010"},
                {"EMP-2011", "Aditya", "Verma", "aditya.verma@company.com", "+919820010011", "1986-12-03", "2018-07-20", "male", "DEPT-5", "Head of Product", "Department_Head", "230000.00", "Bengaluru", "Karnataka", "501, Embassy Pristine, Iblur", "560102", "Pooja Verma", "Spouse", "+919820090011"},
                {"EMP-2012", "Ritu", "Kapoor", "ritu.kapoor@company.com", "+919820010012", "1993-01-22", "2021-04-01", "female", "DEPT-5", "Senior Product Designer", "Employee", "130000.00", "Bengaluru", "Karnataka", "Flat 204, Vaswani Whispering Palms, Marathahalli", "560037", "Kapoor Vinod", "Father", "+919820090012"},
                {"EMP-2013", "Manish", "Tiwari", "manish.tiwari@company.com", "+919820010013", "1987-08-14", "2019-02-15", "male", "DEPT-6", "Operations Lead", "Project_Manager", "160000.00", "Bengaluru", "Karnataka", "Flat 502, Brigade Metropolis, Whitefield", "560048", "Priya Tiwari", "Spouse", "+919820090013"},
                {"EMP-2014", "Pooja", "Nair", "pooja.nair@company.com", "+919820010014", "1995-10-29", "2022-03-01", "female", "DEPT-7", "Junior Software Engineer", "Employee", "65000.00", "Bengaluru", "Karnataka", "102, Shriram Spandhana, Wind Tunnel Road", "560037", "Nair Balakrishnan", "Father", "+919820090014"}
        };

        String defaultHash = passwordEncoder.encode("Password@123");
        List<LeaveType> allLeaveTypes = leaveTypeRepository.findAll();

        for (Object[] row : employeesData) {
            String code = (String) row[0];
            String firstName = (String) row[1];
            String lastName = (String) row[2];
            String email = (String) row[3];
            String phone = (String) row[4];
            LocalDate dob = LocalDate.parse((String) row[5]);
            LocalDate joining = LocalDate.parse((String) row[6]);
            String gender = (String) row[7];
            String deptCode = (String) row[8];
            String desigTitle = (String) row[9];
            String roleName = (String) row[10];
            BigDecimal basicSalary = new BigDecimal((String) row[11]);
            String city = (String) row[12];
            String state = (String) row[13];
            String addressLine = (String) row[14];
            String pincode = (String) row[15];
            String contactName = (String) row[16];
            String contactRel = (String) row[17];
            String contactPhone = (String) row[18];

            if (employeeRepository.findByEmployeeCode(code).isPresent()) {
                continue;
            }

            // 1. User
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                User u = User.builder()
                        .email(email)
                        .displayName(firstName + " " + lastName)
                        .passwordHash(defaultHash)
                        .isActive(true)
                        .build();
                return userRepository.save(u);
            });

            // 2. User Role
            Role role = roleRepository.findByRoleName(roleName).orElse(null);
            if (role != null && !userRoleRepository.existsById(new UserRoleId(user.getUserId(), role.getRoleId()))) {
                UserRole ur = UserRole.builder()
                        .id(new UserRoleId(user.getUserId(), role.getRoleId()))
                        .user(user)
                        .role(role)
                        .assignedAt(OffsetDateTime.now())
                        .build();
                userRoleRepository.save(ur);
            }

            // 3. Department & Designation
            Department dept = departmentRepository.findByDeptCode(deptCode).orElse(null);
            Designation desig = designationRepository.findByTitle(desigTitle).orElse(null);

            // 4. Employee
            Employee employee = Employee.builder()
                    .employeeCode(code)
                    .firstName(firstName)
                    .lastName(lastName)
                    .email(email)
                    .phone(phone)
                    .dateOfBirth(dob)
                    .gender(gender)
                    .joiningDate(joining)
                    .employmentType("full_time")
                    .employeeStatus("active")
                    .isActive(true)
                    .user(user)
                    .department(dept)
                    .designation(desig)
                    .timezone("UTC")
                    .build();

            employee = employeeRepository.save(employee);

            // 5. Address
            Address addr = Address.builder()
                    .streetAddress(addressLine)
                    .city(city)
                    .state(state)
                    .country("India")
                    .pincode(pincode)
                    .build();
            addr = addressRepository.save(addr);

            EmployeeAddress empAddr = EmployeeAddress.builder()
                    .employee(employee)
                    .address(addr)
                    .addressType("current")
                    .isPrimary(true)
                    .build();
            employeeAddressRepository.save(empAddr);

            // 6. Emergency Contact
            EmergencyContact contact = EmergencyContact.builder()
                    .employee(employee)
                    .contactName(contactName)
                    .relationship(contactRel)
                    .phone(contactPhone)
                    .isPrimary(true)
                    .build();
            emergencyContactRepository.save(contact);


            // 7. Salary & Components (Basic + HRA + Special - PF - Tax)
            BigDecimal hra = basicSalary.multiply(new BigDecimal("0.40"));
            BigDecimal special = basicSalary.multiply(new BigDecimal("0.15"));
            BigDecimal pf = basicSalary.multiply(new BigDecimal("0.12"));
            BigDecimal tax = new BigDecimal("2500.00");
            BigDecimal netSalary = basicSalary.add(hra).add(special).subtract(pf).subtract(tax);

            Salary salary = Salary.builder()
                    .employee(employee)
                    .basicSalary(basicSalary)
                    .netSalary(netSalary)
                    .currency("INR")
                    .effectiveFrom(joining)
                    .effectiveTo(null)
                    .build();
            salary = salaryRepository.save(salary);

            salaryComponentRepository.save(SalaryComponent.builder().salary(salary).componentName("House Rent Allowance (HRA)").componentType("earning").amount(hra).build());
            salaryComponentRepository.save(SalaryComponent.builder().salary(salary).componentName("Special Allowance").componentType("earning").amount(special).build());
            salaryComponentRepository.save(SalaryComponent.builder().salary(salary).componentName("Provident Fund (PF)").componentType("deduction").amount(pf).build());
            salaryComponentRepository.save(SalaryComponent.builder().salary(salary).componentName("Professional Tax").componentType("deduction").amount(tax).build());

            // 8. Bank Detail
            String acctNum = "50100" + code.replace("EMP-", "") + "9211";
            BankDetail bank = BankDetail.builder()
                    .employee(employee)
                    .bankName("HDFC Bank")
                    .branchName("Koramangala, Bengaluru")
                    .accountNumber(acctNum)
                    .routingCode("HDFC0001234")
                    .accountType("savings")
                    .isPrimary(true)
                    .build();
            bankDetailRepository.save(bank);

            // 9. Leave Balances for 2026
            for (LeaveType lt : allLeaveTypes) {
                EmployeeLeaveBalance balance = EmployeeLeaveBalance.builder()
                        .employee(employee)
                        .leaveType(lt)
                        .year(2026)
                        .totalAllocated(lt.getMaxDaysPerYear() != null ? lt.getMaxDaysPerYear() : 0)
                        .usedLeaves(0)
                        .build();
                leaveBalanceRepository.save(balance);
            }

            log.info("Seeded employee profile: {} ({})", code, email);
        }
    }
}
