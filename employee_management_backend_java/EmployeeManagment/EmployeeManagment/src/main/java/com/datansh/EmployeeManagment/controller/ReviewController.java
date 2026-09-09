package com.datansh.EmployeeManagment.controller;

import com.datansh.EmployeeManagment.dto.ReviewIn;
import com.datansh.EmployeeManagment.dto.ReviewOut;
import com.datansh.EmployeeManagment.dto.ReviewUpdateIn;
import com.datansh.EmployeeManagment.exception.ForbiddenException;
import com.datansh.EmployeeManagment.security.UserDetailsImpl;
import com.datansh.EmployeeManagment.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/reviews")
@Tag(name = "Performance Reviews", description = "Periodic performance evaluations and feedback")
public class ReviewController {

    @Autowired
    private ReviewService reviewService;

    @GetMapping
    @Operation(summary = "List Reviews")
    public ResponseEntity<com.datansh.EmployeeManagment.dto.PaginatedReviews> listReviews(
            @RequestParam(required = false) String employee_public_id,
            @RequestParam(required = false) String reviewer_public_id,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(required = false) Integer limit,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("review:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager"))
        );
        String effectiveEmpId = employee_public_id;
        String effectiveReviewerId = reviewer_public_id;

        if (!hasPerm) {
            if (currentUser == null || currentUser.getEmployeePublicId() == null) {
                throw new ForbiddenException("Access not granted: No employee profile is linked to your user account.");
            }
            String callerEmpId = currentUser.getEmployeePublicId().toString();
            // If filtering by specific employee that is not self, check if caller is reviewer
            if (employee_public_id != null && !employee_public_id.equalsIgnoreCase(callerEmpId)) {
                if (reviewer_public_id == null || !reviewer_public_id.equalsIgnoreCase(callerEmpId)) {
                    throw new ForbiddenException("Access not granted: You do not have permission to view performance reviews for other employees.");
                }
            }
            // If filtering by specific reviewer that is not self, check if caller is employee
            if (reviewer_public_id != null && !reviewer_public_id.equalsIgnoreCase(callerEmpId)) {
                if (employee_public_id == null || !employee_public_id.equalsIgnoreCase(callerEmpId)) {
                    throw new ForbiddenException("Access not granted: You do not have permission to view performance reviews conducted by other reviewers.");
                }
            }
            if (employee_public_id == null && reviewer_public_id == null) {
                effectiveEmpId = callerEmpId;
            }
        }

        com.datansh.EmployeeManagment.dto.PaginatedReviews result = reviewService.listReviews(effectiveEmpId, effectiveReviewerId, status, skip, limit);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{public_id}")
    @Operation(summary = "Get Review")
    public ResponseEntity<ReviewOut> getReview(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        ReviewOut review = reviewService.getReviewByPublicId(UUID.fromString(publicId));
        boolean hasPerm = currentUser != null && (
                currentUser.hasPermission("review:read")
                || currentUser.hasPermission("role:manage")
                || currentUser.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_Admin") || a.getAuthority().equals("ROLE_HR_Manager"))
        );
        if (!hasPerm) {
            boolean isRevieweeOrReviewer = currentUser != null && currentUser.getEmployeePublicId() != null
                    && (currentUser.getEmployeePublicId().toString().equalsIgnoreCase(review.getEmployeePublicId())
                        || currentUser.getEmployeePublicId().toString().equalsIgnoreCase(review.getReviewerPublicId()));
            if (!isRevieweeOrReviewer) {
                throw new ForbiddenException("Access not granted: You do not have permission to view this review.");
            }
        }
        return ResponseEntity.ok(review);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('review:create') or hasAuthority('role:manage') or hasRole('Admin')")
    @Operation(summary = "Create Review")
    public ResponseEntity<ReviewOut> createReview(
            @Valid @RequestBody ReviewIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        ReviewOut result = reviewService.createReview(currentUser.getId(), payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{public_id}")
    @Operation(summary = "Update Review")
    public ResponseEntity<ReviewOut> updateReview(
            @PathVariable("public_id") String publicId,
            @Valid @RequestBody ReviewUpdateIn payload,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        ReviewOut existing = reviewService.getReviewByPublicId(UUID.fromString(publicId));
        boolean hasPerm = currentUser.hasPermission("review:create") || currentUser.hasPermission("review:update");
        if (!hasPerm) {
            // Python allows the reviewee and reviewer to update (e.g., acknowledgement flow)
            boolean isRevieweeOrReviewer = currentUser.getEmployeePublicId() != null
                    && (currentUser.getEmployeePublicId().toString().equalsIgnoreCase(existing.getEmployeePublicId())
                        || currentUser.getEmployeePublicId().toString().equalsIgnoreCase(existing.getReviewerPublicId()));
            if (!isRevieweeOrReviewer) {
                throw new ForbiddenException("You do not have permission to update this review.");
            }
        }
        return ResponseEntity.ok(reviewService.updateReview(UUID.fromString(publicId), payload));
    }

    @DeleteMapping("/{public_id}")
    @Operation(summary = "Delete Review (Admin, HR, or Reviewer only)")
    public ResponseEntity<java.util.Map<String, String>> deleteReview(
            @PathVariable("public_id") String publicId,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal UserDetailsImpl currentUser
    ) {
        ReviewOut existing = reviewService.getReviewByPublicId(UUID.fromString(publicId));
        boolean hasPerm = currentUser.hasPermission("review:delete") || currentUser.hasPermission("review:create") || currentUser.hasPermission("role:manage");
        if (!hasPerm) {
            boolean isReviewer = currentUser.getEmployeePublicId() != null
                    && currentUser.getEmployeePublicId().toString().equalsIgnoreCase(existing.getReviewerPublicId());
            if (!isReviewer) {
                throw new ForbiddenException("You do not have permission to delete this review.");
            }
        }
        reviewService.deleteReview(UUID.fromString(publicId));
        java.util.Map<String, String> res = new java.util.HashMap<>();
        res.put("details", "Performance review successfully deleted");
        return ResponseEntity.ok(res);
    }
}

