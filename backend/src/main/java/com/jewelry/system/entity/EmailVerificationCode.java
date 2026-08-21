package com.jewelry.system.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 邮箱验证码：用于海外 C 端邮箱登录/注册/绑定。
 */
@Data
@Entity
@Table(name = "email_verification_code")
@EntityListeners(AuditingEntityListener.class)
public class EmailVerificationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 10)
    private String code;

    /** LOGIN / REGISTER / BIND */
    @Column(nullable = false, length = 20)
    private String purpose;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private Boolean consumed = false;

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
