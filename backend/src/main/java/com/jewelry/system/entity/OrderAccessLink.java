package com.jewelry.system.entity;

import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_access_links")
@EntityListeners(AuditingEntityListener.class)
public class OrderAccessLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "b2b_client_id")
    private Long b2bClientId;

    @Column(name = "access_token", nullable = false, unique = true, length = 64)
    private String accessToken;

    @Column(name = "qrcode_data", columnDefinition = "TEXT")
    private String qrcodeData;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private LinkStatus status = LinkStatus.ACTIVE;

    @Column(name = "expire_time")
    private LocalDateTime expireTime;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum LinkStatus {
        ACTIVE, EXPIRED, DISABLED
    }
}