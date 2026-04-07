package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "design_info")
@EntityListeners(AuditingEntityListener.class)
public class DesignInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "process_info", columnDefinition = "json")
    private String processInfoJson;

    @Column(name = "stone_info", columnDefinition = "json")
    private String stoneInfoJson;

    @Column(name = "design_images", columnDefinition = "json")
    private String designImagesJson;

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
