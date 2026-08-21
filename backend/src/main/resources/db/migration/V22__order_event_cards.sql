-- 订单事件卡片 + 服务类型 + C端邮箱账号
CREATE TABLE order_event (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    event_type VARCHAR(30) NOT NULL COMMENT 'DESIGN_SUBMIT/DESIGN_REJECT/MODEL_SUBMIT/MODEL_REJECT/REVIEW_PASS/REVIEW_REJECT/QUOTATION/PRODUCTION_LOG/STATUS_CHANGE',
    actor_type VARCHAR(30) NOT NULL COMMENT 'STAFF/B2B_CLIENT/C_PORTAL_CUSTOMER',
    actor_id BIGINT NOT NULL COMMENT '操作者账号ID',
    actor_role VARCHAR(30) NULL COMMENT '操作者业务角色',
    title VARCHAR(200) NULL,
    content TEXT NULL,
    reason TEXT NULL COMMENT '驳回/拒绝原因',
    file_ids_json TEXT NULL COMMENT '附件文件ID JSON数组',
    snapshot_json JSON NULL COMMENT '事件快照',
    status VARCHAR(20) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_oe_order (order_id),
    CONSTRAINT fk_oe_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单事件卡片';

ALTER TABLE orders ADD COLUMN service_type VARCHAR(30) NULL COMMENT 'CUSTOM_IMAGE/DESIGNER_DESIGN/B2B_MODEL' AFTER conversation_id;
CREATE INDEX idx_orders_service_type ON orders(service_type);

ALTER TABLE portal_customer_accounts ADD COLUMN email VARCHAR(100) NULL COMMENT '海外C端邮箱账号' AFTER password;
CREATE INDEX idx_pca_email ON portal_customer_accounts(email);
