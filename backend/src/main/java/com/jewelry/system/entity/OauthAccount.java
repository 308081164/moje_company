package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 第三方 OAuth 账号绑定（预留，本期用于 Google 登录）。
 */
@Data
@Entity
@Table(name = "oauth_account")
@EntityListeners(AuditingEntityListener.class)
public class OauthAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** GOOGLE */
    @Column(nullable = false, length = 20)
    private String provider;

    /** OAuth 提供商侧的用户唯一标识（sub） */
    @Column(nullable = false, length = 255)
    private String subject;

    @Column(length = 100)
    private String email;

    /** 关联的内部账号类型：C_PORTAL / B2B / STAFF */
    @Column(name = "account_type", length = 30)
    private String accountType;

    @Column(name = "account_id")
    private Long accountId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
