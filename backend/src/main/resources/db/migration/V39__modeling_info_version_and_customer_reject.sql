ALTER TABLE modeling_info
    ADD COLUMN last_customer_reject_reason TEXT NULL COMMENT '客户最近一次驳回建模稿原因',
    ADD COLUMN last_customer_reject_at TIMESTAMP(6) NULL COMMENT '客户最近一次驳回建模稿时间';

CREATE TABLE modeling_info_version (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    piece_id BIGINT NOT NULL,
    version_no INT NOT NULL,
    label VARCHAR(200) NULL,
    modeler_id BIGINT NULL,
    weight DECIMAL(12, 4) NULL,
    model_notes TEXT NULL,
    model_effect_images JSON NULL,
    model_files JSON NULL,
    submitted_to_customer TINYINT(1) NOT NULL DEFAULT 0,
    created_by BIGINT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_miv_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_miv_piece FOREIGN KEY (piece_id) REFERENCES order_piece (id) ON DELETE CASCADE,
    UNIQUE KEY uk_miv_piece_version (piece_id, version_no),
    INDEX idx_miv_piece_id (piece_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建模稿历史版本（按单件）';
