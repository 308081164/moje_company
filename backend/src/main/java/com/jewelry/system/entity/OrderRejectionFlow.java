package com.jewelry.system.entity;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_rejection_flows")
@EntityListeners(AuditingEntityListener.class)
public class OrderRejectionFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "rejected_by", nullable = false)
    private Long rejectedBy;

    @Column(name = "rejection_type", nullable = false, length = 50)
    private String rejectionType;

    @Column(name = "rejection_reasons", columnDefinition = "TEXT")
    private String rejectionReasons;

    @Column(name = "current_stage", length = 50)
    private String currentStage = "PENDING_FIX";

    @Column(name = "last_status_update_by")
    private Long lastStatusUpdateBy;

    @Column(name = "last_status_update_at")
    private LocalDateTime lastStatusUpdateAt;

    @Column(name = "resubmitted_at")
    private LocalDateTime resubmittedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
