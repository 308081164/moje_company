package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "modeling_info")
@EntityListeners(AuditingEntityListener.class)
public class ModelingInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    private BigDecimal weight;

    @Column(name = "model_files", columnDefinition = "json")
    private String modelFilesJson;

    @Column(name = "model_notes", columnDefinition = "TEXT")
    private String modelNotes;

    @Column(name = "is_customer_approved")
    private Boolean customerApproved;

    @Column(name = "approval_time")
    private LocalDateTime approvalTime;

    @Column(name = "approval_notes", columnDefinition = "TEXT")
    private String approvalNotes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
