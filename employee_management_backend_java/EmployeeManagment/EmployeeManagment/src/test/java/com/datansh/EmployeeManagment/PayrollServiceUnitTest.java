package com.datansh.EmployeeManagment;

import com.datansh.EmployeeManagment.dto.PayrollProcessIn;
import com.datansh.EmployeeManagment.dto.PayrollProcessSummary;
import com.datansh.EmployeeManagment.dto.SalaryComponentIn;
import com.datansh.EmployeeManagment.dto.SalaryCreateIn;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.entity.PayrollRun;
import com.datansh.EmployeeManagment.entity.Salary;
import com.datansh.EmployeeManagment.entity.SalaryComponent;
import com.datansh.EmployeeManagment.repository.*;
import com.datansh.EmployeeManagment.service.PayrollService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PayrollServiceUnitTest {

    @Mock
    private SalaryRepository salaryRepository;

    @Mock
    private SalaryComponentRepository salaryComponentRepository;

    @Mock
    private BankDetailRepository bankDetailRepository;

    @Mock
    private PayrollRunRepository payrollRunRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private PayrollService payrollService;

    @Test
    @DisplayName("Should process payroll calculation batch correctly")
    void testProcessPayrollBatch() {
        UUID empPublicId = UUID.randomUUID();
        Employee employee = Employee.builder()
                .empId(5L)
                .publicId(empPublicId)
                .firstName("Alice")
                .lastName("Walker")
                .employeeCode("EMP-0005")
                .employeeStatus("active")
                .build();

        Salary salary = Salary.builder()
                .salaryId(1L)
                .publicId(UUID.randomUUID())
                .employee(employee)
                .basicSalary(BigDecimal.valueOf(50000.00))
                .build();

        SalaryComponent c1 = SalaryComponent.builder()
                .componentName("HRA")
                .componentType("earning")
                .amount(BigDecimal.valueOf(20000.00))
                .build();

        SalaryComponent c2 = SalaryComponent.builder()
                .componentName("PF")
                .componentType("deduction")
                .amount(BigDecimal.valueOf(5000.00))
                .build();

        when(employeeRepository.findAll()).thenReturn(List.of(employee));
        when(salaryRepository.findFirstByEmployeeEmpIdAndEffectiveToIsNullOrderByEffectiveFromDesc(5L))
                .thenReturn(Optional.of(salary));
        when(salaryComponentRepository.findBySalarySalaryId(1L)).thenReturn(List.of(c1, c2));
        when(payrollRunRepository.save(any(PayrollRun.class))).thenAnswer(invocation -> {
            PayrollRun pr = invocation.getArgument(0);
            pr.setPayrollId(101L);
            pr.setPublicId(UUID.randomUUID());
            return pr;
        });

        PayrollProcessIn processIn = PayrollProcessIn.builder()
                .payPeriodStart(LocalDate.of(2026, 1, 1))
                .payPeriodEnd(LocalDate.of(2026, 1, 31))
                .paymentDate(LocalDate.of(2026, 2, 1))
                .paymentMethod("bank_transfer")
                .build();

        PayrollProcessSummary summary = payrollService.processPayrollBatch(processIn);

        assertNotNull(summary);
        assertEquals(1, summary.getTotalEmployeesProcessed());
        assertEquals(BigDecimal.valueOf(70000.00), summary.getTotalGrossDisbursed());
        assertEquals(BigDecimal.valueOf(5000.00), summary.getTotalDeductions());
        assertEquals(BigDecimal.valueOf(65000.00), summary.getTotalNetDisbursed());
    }
}
