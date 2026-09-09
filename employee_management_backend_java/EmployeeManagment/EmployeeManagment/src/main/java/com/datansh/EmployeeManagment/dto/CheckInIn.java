package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckInIn {

    @JsonProperty("work_mode")
    @Schema(description = "in_office | remote | field", example = "in_office", defaultValue = "in_office")
    @Builder.Default
    private String workMode = "in_office";

    @JsonProperty("notes")
    @Schema(description = "Optional note for the shift", example = "Morning shift check-in")
    private String notes;

    @JsonProperty("timezone")
    @Schema(description = "Optional client timezone e.g. Asia/Kolkata, America/New_York, UTC", example = "Asia/Kolkata")
    private String timezone;
}
