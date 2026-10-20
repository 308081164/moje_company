-- 订单单件：每单最多 5 件，设计/建模按件确认
CREATE TABLE order_piece (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    seq INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    design_confirmed TINYINT(1) NOT NULL DEFAULT 0,
    model_confirmed TINYINT(1) NOT NULL DEFAULT 0,
    reference_images JSON NULL COMMENT '客户参考图/灵感图',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_order_piece_order_seq (order_id, seq),
    KEY idx_order_piece_order_id (order_id),
    CONSTRAINT fk_order_piece_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE design_info
    ADD COLUMN piece_id BIGINT NULL AFTER order_id;

ALTER TABLE modeling_info
    ADD COLUMN piece_id BIGINT NULL AFTER order_id;

ALTER TABLE order_event
    ADD COLUMN piece_id BIGINT NULL AFTER order_id;

-- 为每个已有订单创建默认单件，并按历史客户确认态回填
INSERT INTO order_piece (order_id, seq, name, design_confirmed, model_confirmed, created_at)
SELECT o.id,
       1,
       '主件',
       IF(COALESCE(di.customer_approved, 0) = 1, 1, 0),
       IF(COALESCE(mi.customer_approved, 0) = 1, 1, 0),
       COALESCE(o.created_at, NOW(6))
FROM orders o
LEFT JOIN design_info di ON di.order_id = o.id
LEFT JOIN modeling_info mi ON mi.order_id = o.id;

UPDATE design_info di
    INNER JOIN order_piece op ON op.order_id = di.order_id AND op.seq = 1
SET di.piece_id = op.id
WHERE di.piece_id IS NULL;

UPDATE modeling_info mi
    INNER JOIN order_piece op ON op.order_id = mi.order_id AND op.seq = 1
SET mi.piece_id = op.id
WHERE mi.piece_id IS NULL;

ALTER TABLE design_info
    ADD UNIQUE KEY uk_design_info_piece_id (piece_id);

ALTER TABLE modeling_info
    ADD UNIQUE KEY uk_modeling_info_piece_id (piece_id);
