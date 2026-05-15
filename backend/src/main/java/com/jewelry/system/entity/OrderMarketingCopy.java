package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "order_marketing_copy")
@EntityListeners(AuditingEntityListener.class)
public class OrderMarketingCopy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @Column(name = "xhs_grass_copy", columnDefinition = "MEDIUMTEXT")
    private String xhsGrassCopy;

    @Column(name = "xianyu_taobao_copy", columnDefinition = "MEDIUMTEXT")
    private String xianyuTaobaoCopy;

    @Column(name = "douyin_broadcast_copy", columnDefinition = "MEDIUMTEXT")
    private String douyinBroadcastCopy;

    @Column(name = "generation_complete", nullable = false)
    private boolean generationComplete;

    @Column(name = "last_generated_at")
    private LocalDateTime lastGeneratedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_generated_by_user_id")
    private User lastGeneratedBy;

    @Column(name = "raw_model_response", columnDefinition = "MEDIUMTEXT")
    private String rawModelResponse;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
