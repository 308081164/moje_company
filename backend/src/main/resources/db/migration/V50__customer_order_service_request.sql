-- C 端投诉 / 退款申请工单
CREATE TABLE customer_order_service_request (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    portal_customer_id BIGINT NOT NULL COMMENT '提交人门户账号ID',
    type VARCHAR(20) NOT NULL COMMENT 'COMPLAINT|REFUND',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' COMMENT 'OPEN|IN_PROGRESS|RESOLVED|REJECTED|CANCELLED',
    category VARCHAR(40) NULL COMMENT '申请分类',
    reason TEXT NOT NULL COMMENT '客户说明',
    requested_amount DECIMAL(12, 2) NULL COMMENT '希望退款金额（可选）',
    staff_note VARCHAR(1000) NULL COMMENT '客服处理备注',
    resolved_by BIGINT NULL COMMENT '处理员工ID',
    resolved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    KEY idx_cosr_order (order_id),
    KEY idx_cosr_customer (portal_customer_id),
    KEY idx_cosr_status (status),
    KEY idx_cosr_type_status (type, status)
) COMMENT 'C端订单投诉与退款申请';

ALTER TABLE order_event
    MODIFY COLUMN event_type ENUM(
        'DESIGN_SUBMIT','DESIGN_REJECT','DESIGN_CONFIRM',
        'MODEL_SUBMIT','MODEL_REJECT','MODEL_CONFIRM',
        'REVIEW_PASS','REVIEW_REJECT','QUOTATION','PRODUCTION_LOG',
        'STATUS_CHANGE','DELIVERY_CONFIRM','SHIPPED','DELIVERED',
        'BALANCE_PAYMENT','BALANCE_PAID',
        'SHIPPING_ADDRESS_REQUEST','SHIPPING_ADDRESS_FILLED',
        'DESIGN_OPTIONS_REQUEST','DESIGN_OPTIONS_FILLED',
        'COMPLAINT_SUBMITTED','REFUND_REQUESTED',
        'SERVICE_REQUEST_RESOLVED','SERVICE_REQUEST_REJECTED'
    ) NOT NULL COMMENT '订单事件卡片类型';
