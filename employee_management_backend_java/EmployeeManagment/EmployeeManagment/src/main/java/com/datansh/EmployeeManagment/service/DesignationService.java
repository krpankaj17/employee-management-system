package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.DesignationIn;
import com.datansh.EmployeeManagment.dto.DesignationOut;
import com.datansh.EmployeeManagment.entity.Designation;
import com.datansh.EmployeeManagment.exception.BadRequestException;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.DesignationRepository;
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
public class DesignationService {

    @Autowired
    private DesignationRepository designationRepository;

    @CacheEvict(value = "designations", allEntries = true)
    public DesignationOut createDesignation(DesignationIn payload) {
        if (designationRepository.existsByTitle(payload.getTitle())) {
            throw new BadRequestException("Designation with title '" + payload.getTitle() + "' already exists");
        }

        Designation designation = Designation.builder()
                .title(payload.getTitle())
                .gradeLevel(payload.getGradeLevel())
                .description(payload.getDescription())
                .build();

        designation = designationRepository.save(designation);
        return mapToDto(designation);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "designations", key = "'list_' + #skip + '_' + #limit")
    public com.datansh.EmployeeManagment.dto.PaginatedDesignations listDesignations(int skip, Integer limit) {
        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, pageSize);

        org.springframework.data.domain.Page<Designation> page = designationRepository.findAll(pageable);

        List<DesignationOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return com.datansh.EmployeeManagment.dto.PaginatedDesignations.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }


    @Transactional(readOnly = true)
    @Cacheable(value = "designations", key = "#publicId.toString()")
    public DesignationOut getDesignationByPublicId(UUID publicId) {
        Designation designation = designationRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Designation with public_id '" + publicId + "' not found"));
        return mapToDto(designation);
    }

    @CacheEvict(value = "designations", allEntries = true)
    public DesignationOut updateDesignation(UUID publicId, DesignationIn payload) {
        Designation designation = designationRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Designation with public_id '" + publicId + "' not found"));

        if (!designation.getTitle().equalsIgnoreCase(payload.getTitle()) && designationRepository.existsByTitle(payload.getTitle())) {
            throw new BadRequestException("Designation with title '" + payload.getTitle() + "' already exists");
        }

        designation.setTitle(payload.getTitle());
        designation.setGradeLevel(payload.getGradeLevel());
        designation.setDescription(payload.getDescription());

        designation = designationRepository.save(designation);
        return mapToDto(designation);
    }

    @CacheEvict(value = "designations", allEntries = true)
    public void deleteDesignation(UUID publicId) {
        Designation designation = designationRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Designation with public_id '" + publicId + "' not found"));

        designationRepository.delete(designation);
    }

    public DesignationOut mapToDto(Designation des) {
        return DesignationOut.builder()
                .publicId(des.getPublicId().toString())
                .title(des.getTitle())
                .gradeLevel(des.getGradeLevel())
                .description(des.getDescription())
                .build();
    }
}
