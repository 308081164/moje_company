package com.jewelry.system.entity;

import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
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

    /** 客户邮箱（C 端自助下单时自动带出） */
    @Column(name = "customer_email", length = 100)
    private String customerEmail;

    /** 生产完成后客户填写的收货人 */
    @Column(name = "shipping_recipient", length = 100)
    private String shippingRecipient;

    @Column(name = "shipping_phone", length = 40)
    private String shippingPhone;

    @Column(name = "shipping_country", length = 80)
    private String shippingCountry;

    @Column(name = "shipping_address", columnDefinition = "TEXT")
    private String shippingAddress;

    @Column(name = "shipping_postal_code", length = 20)
    private String shippingPostalCode;

    @Column(name = "shipping_address_at")
    private LocalDateTime shippingAddressAt;
    
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

    /** 服务类型：来图定制 / 设计师设计 / B端建模订单 */
    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", length = 30)
    private ServiceType serviceType;

    /** 来图定制客户额外支付设计师协助费用后已转为设计师设计 */
    @Column(name = "designer_assist_paid")
    private Boolean designerAssistPaid = false;

    @Column(name = "designer_assist_paid_at")
    private LocalDateTime designerAssistPaidAt;

    /** 0=普通排队，1=已支付加急（置顶优先） */
    @Column(name = "priority_tier", nullable = false)
    private Integer priorityTier = 0;

    /** 进入设计/建模处理队列的时间（FIFO 次级排序） */
    @Column(name = "queue_entered_at")
    private LocalDateTime queueEnteredAt;

    @Column(name = "rush_paid_at")
    private LocalDateTime rushPaidAt;

    @Column(name = "rush_fee", precision = 10, scale = 2)
    private BigDecimal rushFee;

    /** 尾款支付时客户勾选：履约完成后自动上架小店 */
    @Column(name = "auto_publish_to_storefront", nullable = false)
    private Boolean autoPublishToStorefront = false;

    /** 关联的站内聊天室 ID */
    @Column(name = "conversation_id")
    private Long conversationId;

    /** 寄售商品 ID（买家复产单） */
    @Column(name = "listing_id")
    private Long listingId;

    /** 寄售卖家门户账号 ID */
    @Column(name = "marketplace_seller_id")
    private Long marketplaceSellerId;

    @Column(name = "sale_price", precision = 12, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "production_fee", precision = 12, scale = 2)
    private BigDecimal productionFee;

    @Column(name = "shipping_fee", precision = 12, scale = 2)
    private BigDecimal shippingFee;

    @Column(name = "seller_payout", precision = 12, scale = 2)
    private BigDecimal sellerPayout;
    
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
        
        OrderStatus previous = this.status;
        // 记录状态变更时间
        switch (targetStatus) {
            case PENDING_DESIGN:
                if (previous != OrderStatus.PENDING_DESIGN && previous != OrderStatus.DESIGNING) {
                    this.queueEnteredAt = LocalDateTime.now();
                }
                break;
            case DESIGNING:
                this.designCompletedTime = null;
                this.modelCompletedTime = null;
                break;
            case PENDING_DESIGN_REVIEW:
                if (previous != OrderStatus.PENDING_DESIGN_REVIEW) {
                    this.queueEnteredAt = LocalDateTime.now();
                }
                break;
            case PENDING_MODEL:
                this.designCompletedTime = LocalDateTime.now();
                if (previous != OrderStatus.PENDING_MODEL && previous != OrderStatus.MODELING) {
                    this.queueEnteredAt = LocalDateTime.now();
                }
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
                if (this.status == OrderStatus.PENDING_REVIEW && this.reviewCompletedTime == null) {
                    this.reviewCompletedTime = LocalDateTime.now();
                }
                if (this.productionStartTime == null) {
                    this.productionStartTime = LocalDateTime.now();
                }
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