package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "holidays", indexes = {
    @Index(name = "idx_holidays_public_id", columnList = "public_id"),
    @Index(name = "idx_holidays_date", columnList = "date"),
    @Index(name = "idx_holidays_year", columnList = "year")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Holiday {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "holiday_id")
    private Long holidayId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "holiday_type", length = 20)
    @Builder.Default
    private String holidayType = "company";

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "is_optional", nullable = false)
    @Builder.Default
    private Boolean isOptional = false;

    @Column(name = "applicable_region", length = 100)
    @Builder.Default
    private String applicableRegion = "ALL";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID();
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
        if (this.holidayType == null) {
            this.holidayType = "company";
        }
        if (this.isOptional == null) {
            this.isOptional = false;
        }
        if (this.applicableRegion == null) {
            this.applicableRegion = "ALL";
        }
        if (this.year == null && this.date != null) {
            this.year = this.date.getYear();
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
