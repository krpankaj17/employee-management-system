package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewOut {

    @JsonProperty("public_id")
    @JsonAlias({"publicId", "public_id"})
    private String publicId;

    @JsonProperty("employee_public_id")
    @JsonAlias({"employeePublicId", "employee_public_id"})
    private String employeePublicId;

    @JsonProperty("employee_name")
    @JsonAlias({"employeeName", "employee_name"})
    private String employeeName;

    @JsonProperty("reviewer_public_id")
    @JsonAlias({"reviewerPublicId", "reviewer_public_id"})
    private String reviewerPublicId;

    @JsonProperty("reviewer_name")
    @JsonAlias({"reviewerName", "reviewer_name"})
    private String reviewerName;

    @JsonProperty("review_period_start")
    @JsonAlias({"reviewPeriodStart", "review_period_start"})
    private String reviewPeriodStart;

    @JsonProperty("review_period_end")
    @JsonAlias({"reviewPeriodEnd", "review_period_end"})
    private String reviewPeriodEnd;

    private BigDecimal rating;
    private String comments;
    private String status;
}

