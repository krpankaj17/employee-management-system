package com.datansh.EmployeeManagment.service;

import com.datansh.EmployeeManagment.dto.ReviewIn;
import com.datansh.EmployeeManagment.dto.ReviewOut;
import com.datansh.EmployeeManagment.dto.ReviewUpdateIn;
import com.datansh.EmployeeManagment.entity.Employee;
import com.datansh.EmployeeManagment.entity.PerformanceReview;
import com.datansh.EmployeeManagment.exception.ResourceNotFoundException;
import com.datansh.EmployeeManagment.repository.EmployeeRepository;
import com.datansh.EmployeeManagment.repository.PerformanceReviewRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class ReviewService {

    @Autowired
    private PerformanceReviewRepository performanceReviewRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    public ReviewOut createReview(Long reviewerEmpId, ReviewIn payload) {
        Employee reviewer = employeeRepository.findById(reviewerEmpId)
                .orElseThrow(() -> new ResourceNotFoundException("Reviewer not found"));

        Employee employee = employeeRepository.findByPublicId(UUID.fromString(payload.getEmployeePublicId()))
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        PerformanceReview review = PerformanceReview.builder()
                .employee(employee)
                .reviewer(reviewer)
                .reviewPeriodStart(payload.getReviewPeriodStart())
                .reviewPeriodEnd(payload.getReviewPeriodEnd())
                .rating(payload.getRating())
                .comments(payload.getComments())
                .status(payload.getStatus() != null ? payload.getStatus() : "draft")
                .build();

        review = performanceReviewRepository.save(review);
        return mapToDto(review);
    }

    @Transactional(readOnly = true)
    public com.datansh.EmployeeManagment.dto.PaginatedReviews listReviews(
            String employeePublicId, String reviewerPublicId, String status,
            int skip, Integer limit
    ) {
        org.springframework.data.jpa.domain.Specification<PerformanceReview> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();

            if (employeePublicId != null && !employeePublicId.isBlank()) {
                predicates.add(cb.equal(root.get("employee").get("publicId"), UUID.fromString(employeePublicId)));
            }
            if (reviewerPublicId != null && !reviewerPublicId.isBlank()) {
                predicates.add(cb.equal(root.get("reviewer").get("publicId"), UUID.fromString(reviewerPublicId)));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase()));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        int pageSize = limit != null && limit > 0 ? limit : 50;
        int pageNumber = skip / pageSize;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(pageNumber, pageSize, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        org.springframework.data.domain.Page<PerformanceReview> page = performanceReviewRepository.findAll(spec, pageable);

        List<ReviewOut> items = page.getContent().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return com.datansh.EmployeeManagment.dto.PaginatedReviews.builder()
                .total(page.getTotalElements())
                .skip(skip)
                .limit(limit)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public ReviewOut getReviewByPublicId(UUID publicId) {
        PerformanceReview review = performanceReviewRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Performance review not found"));
        return mapToDto(review);
    }



    public ReviewOut updateReview(UUID publicId, ReviewUpdateIn payload) {
        PerformanceReview review = performanceReviewRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Performance review not found"));

        if (payload.getRating() != null) review.setRating(payload.getRating());
        if (payload.getComments() != null) review.setComments(payload.getComments());
        if (payload.getStatus() != null) review.setStatus(payload.getStatus());

        review = performanceReviewRepository.save(review);
        return mapToDto(review);
    }

    public void deleteReview(UUID publicId) {
        PerformanceReview review = performanceReviewRepository.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("Performance review not found with public_id " + publicId));
        performanceReviewRepository.delete(review);
    }

    public ReviewOut mapToDto(PerformanceReview r) {
        Employee emp = r.getEmployee();
        Employee reviewer = r.getReviewer();

        return ReviewOut.builder()
                .publicId(r.getPublicId().toString())
                .employeePublicId(emp != null ? emp.getPublicId().toString() : null)
                .employeeName(emp != null ? emp.getFullName() : null)
                .reviewerPublicId(reviewer != null ? reviewer.getPublicId().toString() : null)
                .reviewerName(reviewer != null ? reviewer.getFullName() : null)
                .reviewPeriodStart(r.getReviewPeriodStart().toString())
                .reviewPeriodEnd(r.getReviewPeriodEnd().toString())
                .rating(r.getRating())
                .comments(r.getComments())
                .status(r.getStatus())
                .build();
    }
}
