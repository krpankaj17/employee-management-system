package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewIn {

    @NotBlank(message = "Employee public ID is required")
    @JsonProperty("employee_public_id")
    @JsonAlias({"employeePublicId", "employee_public_id"})
    private String employeePublicId;

    @NotNull(message = "Review period start date is required")
    @JsonProperty("review_period_start")
    @JsonAlias({"reviewPeriodStart", "review_period_start"})
    private LocalDate reviewPeriodStart;

    @NotNull(message = "Review period end date is required")
    @JsonProperty("review_period_end")
    @JsonAlias({"reviewPeriodEnd", "review_period_end"})
    private LocalDate reviewPeriodEnd;

    @DecimalMin(value = "1.0", message = "Rating must be at least 1.0")
    @DecimalMax(value = "5.0", message = "Rating must be at most 5.0")
    @JsonProperty("rating")
    @JsonAlias({"rating", "performance_score"})
    private BigDecimal rating;

    private String comments;

    @Builder.Default
    private String status = "draft"; // draft, submitted, acknowledged, finalized
}

