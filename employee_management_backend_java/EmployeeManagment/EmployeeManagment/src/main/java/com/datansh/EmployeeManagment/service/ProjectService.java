package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.*;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.entity.Project;
import com.datansh.EmployeeManagment.entity.ProjectMember;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.repository.ProjectMemberRepository;
import com.datansh.EmployeeManagment.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;


@Service
@Transactional
public class ProjectService {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    public ProjectOut createProject(ProjectIn payload) {
        Employee head = null;
        String effectiveHeadPid = payload.getEffectiveProjectHeadPublicId();
        if (effectiveHeadPid != null && !effectiveHeadPid.isBlank()) {
            head = employeeRepository.findByPublicId(UUID.fromString(effectiveHeadPid))
                    .orElseThrow(() -> new ResourceNotFoundException("Project head employee not found"));
        }

        Project project = Project.builder()
                .projectName(payload.getProjectName())
                .description(payload.getDescription())
                .projectHead(head)
                .startDate(payload.getStartDate())
                .endDate(payload.getEndDate())
                .status(payload.getStatus() != null ? payload.getStatus() : "planning")
                .build();

        project = projectRepository.save(project);
        return mapToDto(project);
    }

    @Transactional(readOnly = true)
    public PaginatedProjects listProjects(
            String status, String headPublicId, String memberPublicId,
            int skip, Integer limit
    ) {
        Specification<Project> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase()));
            }
            if (headPublicId != null && !headPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("projectHead").get("publicId"), UUID.fromString(headPublicId)));
            }
            if (memberPublicId != null && !memberPublicId.isBlank()) {
                jakarta.persistence.criteria.Join<Project, ProjectMember> membersJoin = root.join("members", jakarta.persistence.criteria.JoinType.INNER);
                predicates.add(cb.equal(membersJoin.get("employee").get("publicId"), UUID.fromString(memberPublicId)));
                query.distinct(true);
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, pageSize, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        org.springframework.data.domain.Page<Project> page = projectRepository.findAll(spec, pageable);

        List<ProjectOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return PaginatedProjects.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }


    @Transactional(readOnly = true)
    public ProjectOut getProjectByPublicId(UUID publicId) {
        Project project = projectRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        return mapToDto(project);
    }

    public ProjectOut updateProject(UUID publicId, ProjectIn payload) {
        Project project = projectRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (payload.getProjectName() != null) project.setProjectName(payload.getProjectName());
        if (payload.getDescription() != null) project.setDescription(payload.getDescription());
        if (payload.getStartDate() != null) project.setStartDate(payload.getStartDate());
        if (payload.getEndDate() != null) project.setEndDate(payload.getEndDate());
        if (payload.getStatus() != null) project.setStatus(payload.getStatus());

        String effectiveHeadPid = payload.getEffectiveProjectHeadPublicId();
        if (effectiveHeadPid != null) {
            if (effectiveHeadPid.isBlank() || "null".equalsIgnoreCase(effectiveHeadPid) || "none".equalsIgnoreCase(effectiveHeadPid)) {
                project.setProjectHead(null);
            } else {
                Employee head = employeeRepository.findByPublicId(UUID.fromString(effectiveHeadPid))
                        .orElseThrow(() -> new ResourceNotFoundException("Project head not found"));
                project.setProjectHead(head);
            }
        }

        project = projectRepository.save(project);
        return mapToDto(project);
    }

    public ProjectMemberOut addMember(UUID projectPublicId, ProjectMemberIn payload) {
        Project project = projectRepository.findByPublicId(projectPublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        Optional<ProjectMember> existing = projectMemberRepository.findByProjectPublicIdAndEmployeePublicId(
                projectPublicId, employee.getPublicId()
        );
        if (existing.isPresent()) {
            throw new BadRequestException("Employee is already a member of this project");
        }

        ProjectMember member = ProjectMember.builder()
                .project(project)
                .employee(employee)
                .roleInProject(payload.getRoleInProject())
                .assignedAt(OffsetDateTime.now())
                .build();

        member = projectMemberRepository.save(member);
        return mapToMemberOut(member);
    }

    public void removeMember(UUID projectPublicId, UUID employeePublicId) {
        ProjectMember member = projectMemberRepository.findByProjectPublicIdAndEmployeePublicId(projectPublicId, employeePublicId)
                .orElseThrow(() -> new ResourceNotFoundException("Project member record not found"));

        projectMemberRepository.delete(member);
    }

    public void deleteProject(UUID publicId) {
        Project project = projectRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        projectRepository.delete(project);
    }

    public ProjectOut mapToDto(Project p) {
        List<ProjectMemberOut> members = projectMemberRepository.findByProjectProjectId(p.getProjectId()).stream()
                .map(this::mapToMemberOut)
                .collect(Collectors.toList());

        String headPublicId = p.getProjectHead() != null ? p.getProjectHead().getPublicId().toString() : null;
        String headName = p.getProjectHead() != null ? p.getProjectHead().getFullName() : null;

        return ProjectOut.builder()
                .publicId(p.getPublicId().toString())
                .projectName(p.getProjectName())
                .description(p.getDescription())
                .projectHeadPublicId(headPublicId)
                .projectHeadName(headName)
                .headEmployeePublicId(headPublicId)
                .headEmployeeName(headName)
                .startDate(p.getStartDate() != null ? p.getStartDate().toString() : null)
                .endDate(p.getEndDate() != null ? p.getEndDate().toString() : null)
                .status(p.getStatus())
                .memberCount(members.size())
                .membersCount(members.size())
                .members(members)
                .build();
    }

    public ProjectMemberOut mapToMemberOut(ProjectMember m) {
        Employee emp = m.getEmployee();
        return ProjectMemberOut.builder()
                .employeePublicId(emp != null ? emp.getPublicId().toString() : null)
                .employeeName(emp != null ? emp.getFullName() : null)
                .employeeCode(emp != null ? emp.getEmployeeCode() : null)
                .roleInProject(m.getRoleInProject())
                .assignedAt(m.getAssignedAt() != null ? m.getAssignedAt().toString() : null)
                .build();
    }
}
