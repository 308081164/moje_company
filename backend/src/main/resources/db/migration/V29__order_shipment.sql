-- 国际物流模块：订单发货/物流跟踪（17TRACK 集成）
CREATE TABLE order_shipment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    tracking_number VARCHAR(64) NOT NULL COMMENT '快递单号',
    carrier_code INT NULL COMMENT '17TRACK 承运商编码（可空，自动识别）',
    carrier_name VARCHAR(100) NULL COMMENT '承运商名称',
    status VARCHAR(30) NULL COMMENT '原始状态码（17TRACK status）',
    status_label VARCHAR(50) NULL COMMENT '状态中文标签',
    tracking_events_json TEXT NULL COMMENT '物流轨迹事件 JSON 数组',
    query_url VARCHAR(255) NULL COMMENT '17TRACK 官方查询链接',
    shipped_at TIMESTAMP NULL COMMENT '发货时间',
    delivered_at TIMESTAMP NULL COMMENT '签收时间',
    last_sync_at TIMESTAMP NULL COMMENT '最近一次同步时间',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_shipment_order (order_id),
    CONSTRAINT fk_shipment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单发货/物流跟踪';

-- 扩展 order_event.event_type 枚举：新增发货与签收事件类型
ALTER TABLE order_event
    MODIFY COLUMN event_type ENUM(
        'DESIGN_SUBMIT','DESIGN_REJECT','DESIGN_CONFIRM',
        'MODEL_SUBMIT','MODEL_REJECT','MODEL_CONFIRM',
        'REVIEW_PASS','REVIEW_REJECT','QUOTATION','PRODUCTION_LOG',
        'STATUS_CHANGE','DELIVERY_CONFIRM','SHIPPED','DELIVERED'
    ) NOT NULL COMMENT '订单事件卡片类型';
