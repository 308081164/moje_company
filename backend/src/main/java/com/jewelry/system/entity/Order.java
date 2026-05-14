package com.jewelry.system.entity;

import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "orders")
@EntityListeners(AuditingEntityListener.class)
public class Order {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;
    
    @Column(name = "customer_name", length = 100)
    private String customerName;
    
    @Column(name = "customer_phone", length = 20)
    private String customerPhone;
    
    @Column(name = "customer_wechat", length = 100)
    private String customerWechat;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderSource source;
    
    @Column(name = "influencer_name", length = 100)
    private String influencerName;
    
    @Column(precision = 10, scale = 2)
    private BigDecimal deposit = BigDecimal.ZERO;
    
    @Column(name = "basic_requirements", columnDefinition = "TEXT")
    private String basicRequirements;
    
    @Column(name = "style_info", columnDefinition = "TEXT")
    private String styleInfo;
    
    @Column(name = "material_info", columnDefinition = "TEXT")
    private String materialInfo;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OrderStatus status = OrderStatus.PENDING_DESIGN;
    
    // 关联人员
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_pre_id")
    private User salesPre;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sales_mid_id")
    private User salesMid;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_id")
    private User designer;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modeler_id")
    private User modeler;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "follow_up_id")
    private User followUp;
    
    // B端标识
    @Column(name = "is_b2b")
    private Boolean isB2b = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "b2b_client_id")
    private B2BClient b2bClient;
    
    // 时间信息
    @Column(name = "order_time")
    private LocalDateTime orderTime;
    
    @Column(name = "design_completed_time")
    private LocalDateTime designCompletedTime;
    
    @Column(name = "model_completed_time")
    private LocalDateTime modelCompletedTime;
    
    @Column(name = "review_completed_time")
    private LocalDateTime reviewCompletedTime;
    
    @Column(name = "production_start_time")
    private LocalDateTime productionStartTime;
    
    @Column(name = "production_completed_time")
    private LocalDateTime productionCompletedTime;
    
    @Column(name = "cancelled_time")
    private LocalDateTime cancelledTime;
    
    @Column(name = "assigned_to_designer_at")
    private LocalDateTime assignedToDesignerAt;
    
    @Column(name = "assigned_to_modeler_at")
    private LocalDateTime assignedToModelerAt;
    
    @Column(name = "last_reminder_sent_at")
    private LocalDateTime lastReminderSentAt;

    /** 企业微信「加入群聊」配置 ID（见官方 groupchat/add_join_way） */
    @Column(name = "wecom_join_config_id", length = 128)
    private String wecomJoinConfigId;

    /** 进群二维码图片 Base64（不含 data: 前缀） */
    @Column(name = "wecom_join_qr_base64", columnDefinition = "MEDIUMTEXT")
    private String wecomJoinQrBase64;

    /** 企微自动进群失败原因 */
    @Column(name = "wecom_join_error", length = 1000)
    private String wecomJoinError;
    
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // 辅助方法
    public boolean canTransitionTo(OrderStatus targetStatus) {
        return this.status.canTransitionTo(targetStatus);
    }
    
    public void transitionTo(OrderStatus targetStatus) {
        if (!canTransitionTo(targetStatus)) {
            throw new IllegalStateException(
                String.format("订单状态不能从 %s 流转到 %s", 
                    this.status.getDescription(), 
                    targetStatus.getDescription())
            );
        }
        
        // 记录状态变更时间
        switch (targetStatus) {
            case DESIGNING:
                this.designCompletedTime = null;
                this.modelCompletedTime = null;
                break;
            case PENDING_MODEL:
                this.designCompletedTime = LocalDateTime.now();
                break;
            case MODELING:
                this.modelCompletedTime = null;
                break;
            case PENDING_REVIEW:
                this.modelCompletedTime = LocalDateTime.now();
                break;
            case PENDING_PRODUCTION:
                this.reviewCompletedTime = LocalDateTime.now();
                break;
            case PRODUCING:
                this.productionStartTime = LocalDateTime.now();
                break;
            case COMPLETED:
                this.productionCompletedTime = LocalDateTime.now();
                break;
            case CANCELLED:
                this.cancelledTime = LocalDateTime.now();
                break;
        }
        
        this.status = targetStatus;
    }
    
    public boolean isCancelled() {
        return OrderStatus.CANCELLED.equals(this.status);
    }
    
    public boolean isCompleted() {
        return OrderStatus.COMPLETED.equals(this.status);
    }
    
    public boolean isInProgress() {
        return !isCancelled() && !isCompleted();
    }
}