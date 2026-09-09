
package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.DepartmentEmployees;
import com.datansh.EmployeeManagment.dto.DepartmentEmployeeOut;
import com.datansh.EmployeeManagment.dto.DepartmentIn;
import com.datansh.EmployeeManagment.dto.DepartmentOut;
import com.datansh.EmployeeManagment.entity.Department;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.DepartmentRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class DepartmentService {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @CacheEvict(value = "departments", allEntries = true)
    public DepartmentOut createDepartment(DepartmentIn payload) {
        if (departmentRepository.existsByDeptName(payload.getDeptName())) {
            throw new BadRequestException("Department with name '" + payload.getDeptName() + "' already exists");
        }
        if (departmentRepository.existsByDeptCode(payload.getDeptCode())) {
            throw new BadRequestException("Department with code '" + payload.getDeptCode() + "' already exists");
        }

        Employee head = null;
        if (payload.getHeadEmployeePublicId() != null && !payload.getHeadEmployeePublicId().isBlank()) {
            head = employeeRepository.findByPublicId(UUID.fromString(payload.getHeadEmployeePublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Head employee not found"));
        }

        Department dept = Department.builder()
                .deptName(payload.getDeptName())
                .deptCode(payload.getDeptCode())
                .description(payload.getDescription())
                .headEmployee(head)
                .build();

        dept = departmentRepository.save(dept);
        return mapToDto(dept);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "departments", key = "'list_' + #skip + '_' + #limit")
    public com.datansh.EmployeeManagment.dto.PaginatedDepartments listDepartments(int skip, Integer limit) {
        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, pageSize);

        org.springframework.data.domain.Page<Department> page = departmentRepository.findAll(pageable);

        List<DepartmentOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return com.datansh.EmployeeManagment.dto.PaginatedDepartments.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }


    @Transactional(readOnly = true)
    @Cacheable(value = "departments", key = "#publicId.toString()")
    public DepartmentOut getDepartmentByPublicId(UUID publicId) {
        Department dept = departmentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Department with public_id '" + publicId + "' not found"));
        return mapToDto(dept);
    }

    @CacheEvict(value = "departments", allEntries = true)
    public DepartmentOut updateDepartment(UUID publicId, DepartmentIn payload) {
        Department dept = departmentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Department with public_id '" + publicId + "' not found"));

        if (!dept.getDeptName().equalsIgnoreCase(payload.getDeptName()) && departmentRepository.existsByDeptName(payload.getDeptName())) {
            throw new BadRequestException("Department with name '" + payload.getDeptName() + "' already exists");
        }
        if (!dept.getDeptCode().equalsIgnoreCase(payload.getDeptCode()) && departmentRepository.existsByDeptCode(payload.getDeptCode())) {
            throw new BadRequestException("Department with code '" + payload.getDeptCode() + "' already exists");
        }

        dept.setDeptName(payload.getDeptName());
        dept.setDeptCode(payload.getDeptCode());
        dept.setDescription(payload.getDescription());

        if (payload.getHeadEmployeePublicId() != null && !payload.getHeadEmployeePublicId().isBlank()) {
            Employee head = employeeRepository.findByPublicId(UUID.fromString(payload.getHeadEmployeePublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Head employee not found"));
            dept.setHeadEmployee(head);
        } else {
            dept.setHeadEmployee(null);
        }

        dept = departmentRepository.save(dept);
        return mapToDto(dept);
    }

    @CacheEvict(value = "departments", allEntries = true)
    public void deleteDepartment(UUID publicId) {
        Department dept = departmentRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Department with public_id '" + publicId + "' not found"));

        List<Employee> assignedEmployees = employeeRepository.findByDepartmentDeptId(dept.getDeptId());
        if (!assignedEmployees.isEmpty()) {
            throw new BadRequestException("Cannot delete department with " + assignedEmployees.size() + " active assigned employees");
        }

        departmentRepository.delete(dept);
    }

    @Transactional(readOnly = true)
    public DepartmentOut getMyDepartment(UUID userPublicId) {
        Employee employee = employeeRepository.findByUserPublicId(userPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("No employee profile found for the current user"));

        if (employee.getDepartment() == null) {
            throw new ResourceNotFoundException("No department assigned to the current user");
        }

        return mapToDto(employee.getDepartment());
    }

    @Transactional(readOnly = true)
    public DepartmentEmployees getMyDepartmentEmployees(UUID userPublicId, int skip, Integer limit) {
        Employee employee = employeeRepository.findByUserPublicId(userPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("No employee profile found for the current user"));

        if (employee.getDepartment() == null) {
            throw new ResourceNotFoundException("No department assigned to the current user");
        }

        return getDepartmentEmployees(employee.getDepartment().getPublicId(), skip, limit);
    }

    @Transactional(readOnly = true)
    public DepartmentEmployees getDepartmentEmployees(UUID departmentPublicId, int skip, Integer limit) {
        Department dept = departmentRepository.findByPublicId(departmentPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Department with public_id '" + departmentPublicId + "' not found"));

        List<Employee> allEmps = employeeRepository.findByDepartmentDeptId(dept.getDeptId());
        long total = allEmps.size();

        List<com.datansh.EmployeeManagment.dto.DepartmentEmployeeOut> items = allEmps.stream()
                .skip(skip)
                .limit(limit != null ? limit : allEmps.size())
                .map(e -> com.datansh.EmployeeManagment.dto.DepartmentEmployeeOut.builder()
                        .publicId(e.getPublicId().toString())
                        .employeeCode(e.getEmployeeCode())
                        .firstName(e.getFirstName())
                        .lastName(e.getLastName())
                        .email(e.getEmail())
                        .employeeStatus(e.getEmployeeStatus())
                        .build())
                .collect(Collectors.toList());

        return DepartmentEmployees.builder()
                .departmentPublicId(dept.getPublicId().toString())
                .total(total)
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    public DepartmentOut mapToDto(Department dept) {
        String headPublicId = dept.getHeadEmployee() != null && dept.getHeadEmployee().getPublicId() != null
                ? dept.getHeadEmployee().getPublicId().toString()
                : null;

        String headName = null;
        if (dept.getHeadEmployee() != null) {
            headName = (dept.getHeadEmployee().getFirstName() != null ? dept.getHeadEmployee().getFirstName() : "")
                    + " " + (dept.getHeadEmployee().getLastName() != null ? dept.getHeadEmployee().getLastName() : "");
            headName = headName.trim();
            if (headName.isEmpty()) headName = null;
        }

        long empCount = dept.getDeptId() != null
                ? employeeRepository.countByDepartmentDeptId(dept.getDeptId())
                : 0L;

        return DepartmentOut.builder()
                .publicId(dept.getPublicId().toString())
                .deptName(dept.getDeptName())
                .deptCode(dept.getDeptCode())
                .description(dept.getDescription())
                .headEmployeePublicId(headPublicId)
                .headEmployeeName(headName)
                .employeeCount(empCount)
                .build();
    }
}
