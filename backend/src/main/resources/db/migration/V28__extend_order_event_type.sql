-- 扩展 order_event.event_type 枚举：新增客户确认与交付确认事件类型
ALTER TABLE order_event
    MODIFY COLUMN event_type ENUM(
        'DESIGN_SUBMIT','DESIGN_REJECT','DESIGN_CONFIRM',
        'MODEL_SUBMIT','MODEL_REJECT','MODEL_CONFIRM',
        'REVIEW_PASS','REVIEW_REJECT','QUOTATION','PRODUCTION_LOG',
        'STATUS_CHANGE','DELIVERY_CONFIRM'
    ) NOT NULL COMMENT '订单事件卡片类型';
