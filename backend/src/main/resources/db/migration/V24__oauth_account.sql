-- 第三方 OAuth 账号绑定（预留 Google 登录）
CREATE TABLE oauth_account (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(20) NOT NULL COMMENT 'GOOGLE',
    subject VARCHAR(255) NOT NULL COMMENT 'OAuth提供商侧用户唯一标识',
    email VARCHAR(100) NULL,
    account_type VARCHAR(30) NULL COMMENT '关联内部账号类型',
    account_id BIGINT NULL COMMENT '关联内部账号ID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_oa_provider_subject (provider, subject),
    KEY idx_oa_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth账号绑定';
