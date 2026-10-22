CREATE TABLE order_ai_intake (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    collected_json TEXT NULL,
    turn_count INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NULL ON UPDATE CURRENT_TIMESTAMP(6),
    completed_at DATETIME(6) NULL,
    CONSTRAINT uk_order_ai_intake_order UNIQUE (order_id)
);

CREATE INDEX idx_order_ai_intake_conversation ON order_ai_intake (conversation_id);
