package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "addresses", indexes = {
    @Index(name = "idx_addresses_public_id", columnList = "public_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Address {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "address_id")
    private Long addressId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @Column(name = "street_address", nullable = false, length = 255)
    private String streetAddress;

    @Column(name = "city", nullable = false, length = 100)
    private String city;

    @Column(name = "state", nullable = false, length = 100)
    private String state;

    @Column(name = "country", nullable = false, length = 100)
    @Builder.Default
    private String country = "India";

    @Column(name = "pincode", nullable = false, length = 10)
    private String pincode;

    @OneToMany(mappedBy = "address", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<EmployeeAddress> employeeLinks = new ArrayList<>();

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
        if (this.country == null) {
            this.country = "India";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public String getFormattedAddress() {
        return String.join(", ",
                (streetAddress != null ? streetAddress : ""),
                (city != null ? city : ""),
                (state != null ? state : ""),
                (country != null ? country : ""),
                (pincode != null ? pincode : "")
        );
    }
}
