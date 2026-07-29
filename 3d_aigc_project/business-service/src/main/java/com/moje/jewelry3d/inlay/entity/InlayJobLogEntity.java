package com.moje.jewelry3d.inlay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "inlay_job_log")
public class InlayJobLogEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "job_type", length = 32)
    private String jobType;

    @Column(name = "inlay_id", length = 36)
    private String inlayId;

    @Column(length = 16)
    private String status;

    @Column(length = 32)
    private String method;

    @Column(name = "detail_json", columnDefinition = "TEXT")
    private String detailJson = "{}";

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
