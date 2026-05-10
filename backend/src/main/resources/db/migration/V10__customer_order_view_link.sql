-- C 端客户订单进度公开链接（与 B2B order_access_links 独立，避免业务混用）
CREATE TABLE order_customer_view_link (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    view_token VARCHAR(64) NOT NULL UNIQUE COMMENT '不可猜测的访问令牌',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/EXPIRED/DISABLED',
    expire_time DATETIME NULL COMMENT '过期时间',
    view_count INT NOT NULL DEFAULT 0 COMMENT '访问次数',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_ocv_order_id (order_id),
    INDEX idx_ocv_view_token (view_token),
    CONSTRAINT fk_ocv_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端客户订单进度查看链接';
