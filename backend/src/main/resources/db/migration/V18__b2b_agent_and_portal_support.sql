-- B2B Agent 引导录入会话与消息
CREATE TABLE b2b_agent_session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_token VARCHAR(64) NOT NULL,
    client_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    draft_json JSON NULL,
    committed_order_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_b2b_agent_public_token (public_token),
    KEY idx_b2b_agent_client (client_id),
    KEY idx_b2b_agent_status (status),
    CONSTRAINT fk_b2b_agent_client FOREIGN KEY (client_id) REFERENCES b2b_clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='B2B Agent 对话会话';

CREATE TABLE b2b_agent_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_b2b_agent_msg_session (session_id),
    CONSTRAINT fk_b2b_agent_msg_session FOREIGN KEY (session_id) REFERENCES b2b_agent_session(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='B2B Agent 对话消息';

INSERT INTO system_config (config_key, config_value, config_type, description, created_at, updated_at)
SELECT 'portal.b2b.supportWecomQrUrl', '', 'STRING', 'B端门户客服企业微信二维码图片URL', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'portal.b2b.supportWecomQrUrl');

INSERT INTO system_config (config_key, config_value, config_type, description, created_at, updated_at)
SELECT 'integration.dashscope.chatModel', 'qwen-plus', 'STRING', 'DashScope 文本对话模型（B2B Agent）', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'integration.dashscope.chatModel');
