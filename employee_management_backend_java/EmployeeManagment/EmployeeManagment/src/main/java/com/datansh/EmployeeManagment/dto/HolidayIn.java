package com.datansh.EmployeeManagment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HolidayIn {

    @NotBlank(message = "Holiday name is required")
    private String name;

    @NotNull(message = "Holiday date is required")
    private LocalDate date;

    @Builder.Default
    private String holidayType = "company";

    private Integer year;

    @Builder.Default
    private Boolean isOptional = false;

    @Builder.Default
    private String applicableRegion = "ALL";
}
