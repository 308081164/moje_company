-- 站内聊天系统：订单聊天室 / 成员 / 消息
CREATE TABLE order_conversation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    title VARCHAR(200) NULL COMMENT '聊天室标题',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_oc_order (order_id),
    CONSTRAINT fk_oc_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单聊天室';

CREATE TABLE conversation_member (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL COMMENT '聊天室ID',
    account_type VARCHAR(30) NOT NULL COMMENT 'STAFF/B2B_CLIENT/C_PORTAL_CUSTOMER',
    account_id BIGINT NOT NULL COMMENT '账号ID',
    role VARCHAR(30) NULL COMMENT '业务角色：DESIGNER/SALES_MID/FOLLOW_UP/CUSTOMER等',
    last_read_message_id BIGINT NULL COMMENT '已读游标：最后已读消息ID',
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cm_member (conversation_id, account_type, account_id),
    KEY idx_cm_account (account_type, account_id),
    CONSTRAINT fk_cm_conversation FOREIGN KEY (conversation_id) REFERENCES order_conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天室成员';

CREATE TABLE conversation_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL COMMENT '聊天室ID',
    sender_type VARCHAR(30) NOT NULL COMMENT 'STAFF/B2B_CLIENT/C_PORTAL_CUSTOMER',
    sender_id BIGINT NOT NULL COMMENT '发送者账号ID',
    role VARCHAR(30) NULL COMMENT '发送者业务角色',
    msg_type VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT 'text/image/file/system/event',
    content TEXT NULL,
    file_ids_json TEXT NULL COMMENT '附件文件ID JSON数组',
    event_id BIGINT NULL COMMENT '关联的订单事件卡片ID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cmsg_conversation (conversation_id),
    KEY idx_cmsg_event (event_id),
    CONSTRAINT fk_cmsg_conversation FOREIGN KEY (conversation_id) REFERENCES order_conversation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天室消息';

-- 订单冗余存储聊天室ID（软引用，便于查询；权威关系以 order_conversation.order_id 为准）
ALTER TABLE orders ADD COLUMN conversation_id BIGINT NULL COMMENT '站内聊天室ID' AFTER b2b_client_id;
CREATE INDEX idx_orders_conversation ON orders(conversation_id);
