-- 订单排队与加急优先（$50）
ALTER TABLE orders
    ADD COLUMN priority_tier INT NOT NULL DEFAULT 0 COMMENT '0=普通 1=加急' AFTER designer_assist_paid_at,
    ADD COLUMN queue_entered_at DATETIME NULL COMMENT '进入当前处理队列时间' AFTER priority_tier,
    ADD COLUMN rush_paid_at DATETIME NULL COMMENT '加急费支付时间' AFTER queue_entered_at,
    ADD COLUMN rush_fee DECIMAL(10, 2) NULL COMMENT '加急费用 USD' AFTER rush_paid_at;

-- 存量订单按创建时间入队，便于立刻计算前方等待数
UPDATE orders
SET queue_entered_at = COALESCE(order_time, created_at, NOW())
WHERE queue_entered_at IS NULL
  AND status IN ('PENDING_DESIGN', 'DESIGNING', 'PENDING_MODEL', 'MODELING');

CREATE INDEX idx_orders_queue ON orders (priority_tier, queue_entered_at, id);
CREATE INDEX idx_orders_status_queue ON orders (status, priority_tier, queue_entered_at);

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
        'SERVICE_REQUEST_RESOLVED','SERVICE_REQUEST_REJECTED',
        'SERVICE_REQUEST_CANCELLED','RUSH_PAID'
    ) NOT NULL COMMENT '订单事件卡片类型';
