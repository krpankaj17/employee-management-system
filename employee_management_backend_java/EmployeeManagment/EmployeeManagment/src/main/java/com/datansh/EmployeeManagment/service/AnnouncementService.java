package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.AnnouncementIn;
import com.datansh.EmployeeManagment.dto.AnnouncementOut;
import com.datansh.EmployeeManagment.entity.Announcement;
import com.datansh.EmployeeManagment.entity.Department;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.AnnouncementRepository;
import com.datansh.EmployeeManagment.repository.DepartmentRepository;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class AnnouncementService {

    @Autowired
    private AnnouncementRepository announcementRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    public AnnouncementOut createAnnouncement(Long authorEmpId, AnnouncementIn payload) {
        Employee author = employeeRepository.findById(authorEmpId)
                .orElseThrow(() -> new ResourceNotFoundException("Author employee profile not found"));

        Department targetDept = null;
        if ("department".equalsIgnoreCase(payload.getTargetType()) && payload.getTargetDepartmentPublicId() != null) {
            targetDept = departmentRepository.findByPublicId(UUID.fromString(payload.getTargetDepartmentPublicId()))
                    .orElseThrow(() -> new ResourceNotFoundException("Target department not found"));
        }

        String rawPriority = payload.getPriority() != null ? payload.getPriority().trim().toLowerCase() : "normal";
        if ("medium".equals(rawPriority)) {
            rawPriority = "normal";
        } else if (!java.util.Set.of("low", "normal", "high", "urgent").contains(rawPriority)) {
            rawPriority = "normal";
        }

        Announcement announcement = Announcement.builder()
                .title(payload.getTitle())
                .content(payload.getContent())
                .priority(rawPriority)
                .targetType(payload.getTargetType() != null ? payload.getTargetType().trim().toLowerCase() : "all")
                .targetDepartment(targetDept)
                .author(author)
                .isActive(true)
                .expiresAt(payload.getExpiresAt())
                .build();

        announcement = announcementRepository.save(announcement);
        return mapToDto(announcement);
    }

    @Transactional(readOnly = true)
    public List<AnnouncementOut> getActiveAnnouncements(UUID employeePublicId) {
        if (employeePublicId != null) {
            Employee emp = employeeRepository.findByPublicId(employeePublicId).orElse(null);
            if (emp != null && emp.getDepartment() != null) {
                return announcementRepository.findActiveForDepartment(emp.getDepartment().getDeptId()).stream()
                        .map(this::mapToDto)
                        .collect(Collectors.toList());
            }
        }

        return announcementRepository.findByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public void deactivateAnnouncement(UUID publicId) {
        Announcement announcement = announcementRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found"));

        announcement.setIsActive(false);
        announcementRepository.save(announcement);
    }

    public AnnouncementOut mapToDto(Announcement a) {
        Department dept = a.getTargetDepartment();
        Employee author = a.getAuthor();

        return AnnouncementOut.builder()
                .publicId(a.getPublicId().toString())
                .title(a.getTitle())
                .content(a.getContent())
                .priority(a.getPriority())
                .targetType(a.getTargetType())
                .targetDepartment(dept != null ? dept.getDeptName() : null)
                .targetDepartmentPublicId(dept != null ? dept.getPublicId().toString() : null)
                .authorName(author != null ? author.getFullName() : null)
                .authorPublicId(author != null ? author.getPublicId().toString() : null)
                .isActive(a.getIsActive())
                .expiresAt(a.getExpiresAt() != null ? a.getExpiresAt().toString() : null)
                .build();
    }
}
