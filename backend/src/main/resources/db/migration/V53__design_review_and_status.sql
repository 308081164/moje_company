-- 设计跟单评审：订单状态 + process_review 区分设计/建模评审
ALTER TABLE orders
    MODIFY COLUMN status ENUM(
        'PENDING_DESIGN',
        'DESIGNING',
        'PENDING_DESIGN_REVIEW',
        'PENDING_MODEL',
        'MODELING',
        'PENDING_REVIEW',
        'PENDING_PRODUCTION',
        'PRODUCING',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL COMMENT '订单状态';

ALTER TABLE process_review
    ADD COLUMN review_kind VARCHAR(20) NOT NULL DEFAULT 'MODEL' COMMENT 'DESIGN=设计评审 MODEL=建模工艺评审' AFTER order_id;

CREATE INDEX idx_process_review_order_kind ON process_review (order_id, review_kind, id);