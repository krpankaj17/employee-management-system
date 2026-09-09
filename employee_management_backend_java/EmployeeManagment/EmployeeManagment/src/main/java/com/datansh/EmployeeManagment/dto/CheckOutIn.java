package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckOutIn {

    @JsonProperty("notes")
    @Schema(description = "Optional checkout / handover note", example = "Finished daily tasks")
    private String notes;
}
