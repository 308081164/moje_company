-- 邮箱验证码
CREATE TABLE email_verification_code (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL COMMENT '目标邮箱',
    code VARCHAR(10) NOT NULL COMMENT '验证码',
    purpose VARCHAR(20) NOT NULL COMMENT 'LOGIN/REGISTER/BIND',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    consumed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已使用',
    attempt_count INT NOT NULL DEFAULT 0 COMMENT '校验尝试次数',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_evc_email_purpose (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱验证码';
