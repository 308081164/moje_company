-- C 端门户账号与订单绑定；B 端订单记录所属客户 ID
CREATE TABLE portal_customer_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    contact VARCHAR(100) NOT NULL UNIQUE COMMENT '手机号或微信（登录必填）',
    password VARCHAR(255) NOT NULL COMMENT '密码哈希',
    display_name VARCHAR(100) NULL COMMENT '展示称呼',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pca_contact (contact)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端门户客户账号';

CREATE TABLE portal_customer_order_bindings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    portal_customer_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL UNIQUE COMMENT '同一订单仅绑定一个门户账号',
    bind_source VARCHAR(32) NULL COMMENT 'VIEW_TOKEN|ORDER_PROOF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pcb_customer_order (portal_customer_id, order_id),
    CONSTRAINT fk_pcb_customer FOREIGN KEY (portal_customer_id) REFERENCES portal_customer_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_pcb_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_pcb_customer (portal_customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端客户与订单绑定';

ALTER TABLE orders ADD COLUMN b2b_client_id BIGINT NULL COMMENT 'B端登录客户ID';
CREATE INDEX idx_orders_b2b_client_id ON orders(b2b_client_id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_b2b_client FOREIGN KEY (b2b_client_id) REFERENCES b2b_clients(id) ON DELETE SET NULL;

UPDATE orders o
INNER JOIN order_access_links l ON l.order_id = o.id AND l.b2b_client_id IS NOT NULL
SET o.b2b_client_id = l.b2b_client_id
WHERE o.b2b_client_id IS NULL AND o.is_b2b = TRUE;
