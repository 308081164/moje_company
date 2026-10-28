CREATE TABLE order_customer_brief (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    budget_band VARCHAR(40) NULL,
    pieces_json TEXT NULL,
    size_summary VARCHAR(500) NULL,
    submitted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NULL ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_order_customer_brief_order UNIQUE (order_id)
);
