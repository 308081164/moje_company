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
@Table(name = "customer_order_service_request")
@EntityListeners(AuditingEntityListener.class)
public class CustomerOrderServiceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "portal_customer_id", nullable = false)
    private Long portalCustomerId;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 20)
    private String status = "OPEN";

    @Column(length = 40)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "requested_amount", precision = 12, scale = 2)
    private BigDecimal requestedAmount;

    @Column(name = "staff_note", length = 1000)
    private String staffNote;

    @Column(name = "resolved_by")
    private Long resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
