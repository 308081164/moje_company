package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "referral_binding")
@EntityListeners(AuditingEntityListener.class)
public class ReferralBinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "referral_code_id", nullable = false)
    private Long referralCodeId;

    @Column(name = "referrer_account_id", nullable = false)
    private Long referrerAccountId;

    @Column(name = "buyer_account_id", nullable = false)
    private Long buyerAccountId;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;

    /** 佣金计算基数（定制单定金 / 商城单售价） */
    @Column(name = "order_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal orderAmount;

    @Column(name = "commission_rate", nullable = false, precision = 6, scale = 4)
    private BigDecimal commissionRate;

    @Column(name = "commission_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal commissionAmount;

    /** PENDING 待结算 / SETTLED 已结算 / CANCELLED 已取消 */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "settled_at")
    private LocalDateTime settledAt;
}
