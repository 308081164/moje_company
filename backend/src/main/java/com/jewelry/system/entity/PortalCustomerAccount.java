package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "portal_customer_accounts")
@EntityListeners(AuditingEntityListener.class)
public class PortalCustomerAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String contact;

    @Column(nullable = false, length = 255)
    private String password;

    /** 海外 C 端邮箱账号（邮箱验证码登录） */
    @Column(length = 100)
    private String email;

    /** 语言偏好（用于聊天消息自动翻译） */
    @Column(length = 16)
    private String lang = "en";

    @Column(name = "display_name", length = 100)
    private String displayName;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
