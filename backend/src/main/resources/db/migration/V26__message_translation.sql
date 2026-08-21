-- 聊天消息自动翻译：翻译缓存表 + 账号语言偏好字段
CREATE TABLE conversation_message_translation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL COMMENT '消息ID',
    target_lang VARCHAR(16) NOT NULL COMMENT '目标语言 en/fr/de/es/ja/ko/zh-CN/zh-TW',
    translated_content TEXT NOT NULL COMMENT '翻译结果',
    provider VARCHAR(20) NULL DEFAULT 'dashscope' COMMENT '翻译引擎',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_msg_lang (message_id, target_lang),
    KEY idx_msg (message_id),
    CONSTRAINT fk_cmt_message FOREIGN KEY (message_id) REFERENCES conversation_message(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息翻译缓存';

ALTER TABLE users ADD COLUMN lang VARCHAR(16) NOT NULL DEFAULT 'zh-CN' COMMENT '语言偏好' AFTER email;
ALTER TABLE portal_customer_accounts ADD COLUMN lang VARCHAR(16) NOT NULL DEFAULT 'en' COMMENT '语言偏好' AFTER email;
ALTER TABLE b2b_clients ADD COLUMN lang VARCHAR(16) NOT NULL DEFAULT 'zh-CN' COMMENT '语言偏好' AFTER email;
