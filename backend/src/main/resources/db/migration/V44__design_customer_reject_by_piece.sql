-- 设计稿客户驳回按单件落原因（与 modeling_info.last_customer_reject_* 对称）
ALTER TABLE design_info
    ADD COLUMN last_customer_reject_reason TEXT NULL COMMENT '客户最近一次驳回设计稿原因',
    ADD COLUMN last_customer_reject_at TIMESTAMP(6) NULL COMMENT '客户最近一次驳回设计稿时间';

-- 尚未确认、且最新设计流程事件是驳回的单件，回填原因，便于工作台标出「有单件待修改」
UPDATE design_info di
    INNER JOIN order_piece p ON p.id = di.piece_id AND p.design_confirmed = 0
    INNER JOIN (
        SELECT e.piece_id, e.reason, e.created_at
        FROM order_event e
        INNER JOIN (
            SELECT piece_id, MAX(id) AS max_id
            FROM order_event
            WHERE piece_id IS NOT NULL
              AND event_type IN ('DESIGN_REJECT', 'DESIGN_CONFIRM', 'DESIGN_SUBMIT')
            GROUP BY piece_id
        ) latest ON latest.max_id = e.id
        WHERE e.event_type = 'DESIGN_REJECT'
          AND e.reason IS NOT NULL
          AND CHAR_LENGTH(TRIM(e.reason)) > 0
    ) src ON src.piece_id = di.piece_id
SET di.last_customer_reject_reason = src.reason,
    di.last_customer_reject_at = src.created_at
WHERE di.last_customer_reject_reason IS NULL;

UPDATE modeling_info mi
    INNER JOIN order_piece p ON p.id = mi.piece_id AND p.model_confirmed = 0
    INNER JOIN (
        SELECT e.piece_id, e.reason, e.created_at
        FROM order_event e
        INNER JOIN (
            SELECT piece_id, MAX(id) AS max_id
            FROM order_event
            WHERE piece_id IS NOT NULL
              AND event_type IN ('MODEL_REJECT', 'MODEL_CONFIRM', 'MODEL_SUBMIT')
            GROUP BY piece_id
        ) latest ON latest.max_id = e.id
        WHERE e.event_type = 'MODEL_REJECT'
          AND e.reason IS NOT NULL
          AND CHAR_LENGTH(TRIM(e.reason)) > 0
    ) src ON src.piece_id = mi.piece_id
SET mi.last_customer_reject_reason = src.reason,
    mi.last_customer_reject_at = src.created_at
WHERE mi.last_customer_reject_reason IS NULL
   OR CHAR_LENGTH(TRIM(mi.last_customer_reject_reason)) = 0;
