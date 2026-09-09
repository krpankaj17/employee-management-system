package com.datansh.EmployeeManagment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "announcements", indexes = {
    @Index(name = "idx_announcements_public_id", columnList = "public_id"),
    @Index(name = "idx_announcements_target_type", columnList = "target_type"),
    @Index(name = "idx_announcements_target_dept_id", columnList = "target_dept_id"),
    @Index(name = "idx_announcements_posted_by", columnList = "posted_by"),
    @Index(name = "idx_announcements_is_active", columnList = "is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "announcement_id")
    private Long announcementId;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "priority", length = 20)
    @Builder.Default
    private String priority = "normal"; // low, normal, high, urgent

    @Column(name = "target_type", nullable = false, length = 20)
    @Builder.Default
    private String targetType = "all"; // all, department

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_dept_id")
    private Department targetDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "posted_by", nullable = false)
    private Employee author;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

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
        if (this.priority == null) {
            this.priority = "normal";
        }
        if (this.targetType == null) {
            this.targetType = "all";
        }
        if (this.isActive == null) {
            this.isActive = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
