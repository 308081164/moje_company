-- 已完成订单的营销文案（通义千问生成），售前/管理员/售中共享
CREATE TABLE order_marketing_copy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    order_id BIGINT NOT NULL UNIQUE COMMENT '订单',
    xhs_grass_copy MEDIUMTEXT NULL COMMENT '小红书种草文案',
    xianyu_taobao_copy MEDIUMTEXT NULL COMMENT '闲鱼/淘宝展示文案',
    douyin_broadcast_copy MEDIUMTEXT NULL COMMENT '抖音口播文案',
    generation_complete TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已一键生成并写入',
    last_generated_at DATETIME NULL,
    last_generated_by_user_id BIGINT NULL,
    raw_model_response MEDIUMTEXT NULL COMMENT '最近一次模型原始回复（截断存储）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_omc_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_omc_user FOREIGN KEY (last_generated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_omc_pending (generation_complete, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单营销文案';

-- 历史已完成订单进入「待生成」池
INSERT INTO order_marketing_copy (order_id, generation_complete, created_at)
SELECT o.id, 0, CURRENT_TIMESTAMP
FROM orders o
WHERE o.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM order_marketing_copy m WHERE m.order_id = o.id);
