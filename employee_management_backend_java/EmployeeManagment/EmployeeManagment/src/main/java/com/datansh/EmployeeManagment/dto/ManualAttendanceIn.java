package com.datansh.EmployeeManagment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualAttendanceIn {

    @JsonProperty("employee_public_id")
    @Schema(description = "UUID (public_id) of the employee (defaults to authenticated employee if omitted)")
    private String employeePublicId;

    @JsonProperty("date")
    @Schema(description = "Format YYYY-MM-DD (past dates, or future dates if status is on_leave)")
    private LocalDate date;

    @JsonProperty("check_in")
    @Schema(description = "Format HH:MM:SS or ISO timestamp", example = "09:00:00")
    private String checkIn;

    @JsonProperty("check_out")
    @Schema(description = "Format HH:MM:SS or ISO timestamp", example = "17:30:00")
    private String checkOut;

    @JsonProperty("work_mode")
    @Schema(description = "in_office | remote | field", example = "in_office", defaultValue = "in_office")
    @Builder.Default
    private String workMode = "in_office";

    @JsonProperty("status")
    @Schema(description = "present | half_day | absent | on_leave", example = "present", defaultValue = "present")
    @Builder.Default
    private String status = "present";

    @JsonProperty("timezone")
    @Schema(description = "Timezone e.g. Asia/Kolkata, America/New_York, UTC", example = "UTC", defaultValue = "UTC")
    @Builder.Default
    private String timezone = "UTC";

    @JsonProperty("notes")
    @Schema(description = "Optional notes or reason for manual record")
    private String notes;
}
