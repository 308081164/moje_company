-- 跟单质量审核按单件：设计/建模各自独立通过标记；process_review 可记录单件
ALTER TABLE order_piece
    ADD COLUMN design_quality_passed TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '跟单设计质量评审是否通过（按件）' AFTER model_confirmed,
    ADD COLUMN model_quality_passed TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '跟单建模质量评审是否通过（按件）' AFTER design_quality_passed;

ALTER TABLE process_review
    ADD COLUMN piece_id BIGINT NULL COMMENT '按件评审时的单件 ID；空表示整单历史兼容' AFTER order_id;

CREATE INDEX idx_process_review_piece ON process_review (piece_id);
