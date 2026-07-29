package com.moje.jewelry3d.inlay.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "inlay_preview_job")
public class InlayPreviewJobEntity {

    @Id
    @Column(length = 36)
    private String id;

    @JsonProperty("inlay_id")
    @Column(name = "inlay_id", nullable = false, length = 36)
    private String inlayId;

    @JsonProperty("job_type")
    @Column(name = "job_type", nullable = false, length = 32)
    private String jobType = "preview";

    @Column(nullable = false)
    private int priority;

    @Column(nullable = false, length = 16)
    private String status = "pending";

    @Column(nullable = false)
    private int attempts;

    @JsonProperty("error_msg")
    @Column(name = "error_msg", columnDefinition = "TEXT")
    private String errorMsg;

    @JsonProperty("created_at")
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @JsonProperty("updated_at")
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
