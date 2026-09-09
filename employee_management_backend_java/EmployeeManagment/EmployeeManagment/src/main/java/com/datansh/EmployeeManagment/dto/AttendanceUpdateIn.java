package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceUpdateIn {

    @JsonProperty("work_mode")
    @Schema(description = "in_office | remote | field", example = "in_office")
    private String workMode;

    @JsonProperty("status")
    @Schema(description = "present | half_day | absent | on_leave", example = "present")
    private String status;

    @JsonProperty("timezone")
    @Schema(description = "Timezone e.g. Asia/Kolkata, America/New_York, UTC", example = "UTC")
    private String timezone;

    @JsonProperty("notes")
    @Schema(description = "Optional note or reason for adjustment", example = "Approved half-day due to personal reason")
    private String notes;
}

