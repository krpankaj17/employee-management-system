package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "employee_documents", indexes = {
    @Index(name = "idx_documents_public_id", columnList = "public_id"),
    @Index(name = "idx_documents_emp", columnList = "employee_id"),
    @Index(name = "idx_documents_type", columnList = "document_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "document_id")
    private Long documentId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "document_name", nullable = false, length = 255)
    private String documentName;

    @Column(name = "document_type", nullable = false, length = 30)
    private String documentType; // aadhaar, pan, passport, resume, offer_letter, experience_letter, other

    @Column(name = "document_url", nullable = false, columnDefinition = "TEXT")
    private String documentUrl;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "Pending_Verification";

    @Column(name = "verification_notes", columnDefinition = "TEXT")
    private String verificationNotes;

    @Column(name = "verified_by_user_id", length = 50)
    private String verifiedByUserId;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private OffsetDateTime uploadedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID();
        }
        if (this.status == null || this.status.isBlank()) {
            this.status = "Pending_Verification";
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (this.uploadedAt == null) {
            this.uploadedAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
