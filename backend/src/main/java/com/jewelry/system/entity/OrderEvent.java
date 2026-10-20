package com.jewelry.system.entity;

import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.security.AccountKind;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 订单事件卡片：设计师/建模师提交、客户驳回、工艺验证、报价、生产跟单、状态变更等关键节点，
 * 作为订单信息持久化记录，客户端每次提交展示为一张可点击查看详情的卡片。
 */
@Data
@Entity
@Table(name = "order_event")
@EntityListeners(AuditingEntityListener.class)
public class OrderEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "piece_id")
    private Long pieceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private OrderEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false, length = 30)
    private AccountKind actorType;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(name = "actor_role", length = 30)
    private String actorRole;

    @Column(length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    /** 驳回/拒绝原因 */
    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "file_ids_json", columnDefinition = "TEXT")
    private String fileIdsJson;

    /** 事件发生时的快照 JSON */
    @Column(name = "snapshot_json", columnDefinition = "JSON")
    private String snapshotJson;

    @Column(length = 20)
    private String status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
