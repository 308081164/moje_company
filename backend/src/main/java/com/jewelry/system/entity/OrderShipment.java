package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 订单发货/物流跟踪（17TRACK 集成）。一个订单一条物流记录，跟单员发货时录入快递单号。
 */
@Data
@Entity
@Table(name = "order_shipment")
@EntityListeners(AuditingEntityListener.class)
public class OrderShipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "tracking_number", nullable = false, length = 64)
    private String trackingNumber;

    /** 17TRACK 承运商编码（可空，自动识别） */
    @Column(name = "carrier_code")
    private Integer carrierCode;

    @Column(name = "carrier_name", length = 100)
    private String carrierName;

    /** 原始状态码（17TRACK status） */
    @Column(length = 30)
    private String status;

    /** 状态中文标签 */
    @Column(name = "status_label", length = 50)
    private String statusLabel;

    /** 物流轨迹事件 JSON 数组 */
    @Column(name = "tracking_events_json", columnDefinition = "TEXT")
    private String trackingEventsJson;

    /** 17TRACK 官方查询链接 */
    @Column(name = "query_url", length = 255)
    private String queryUrl;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "last_sync_at")
    private LocalDateTime lastSyncAt;

    @Transient
    private String lastMileName;

    @Transient
    private String lastMileTracking;

    @Transient
    private String lastMileSite;

    @Transient
    private String lastMilePhone;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
