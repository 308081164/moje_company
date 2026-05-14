package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "portal_customer_order_bindings")
@EntityListeners(AuditingEntityListener.class)
public class PortalCustomerOrderBinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "portal_customer_id", nullable = false)
    private Long portalCustomerId;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;

    @Column(name = "bind_source", length = 32)
    private String bindSource;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
