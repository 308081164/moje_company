CREATE TABLE order_production_follow_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    note TEXT,
    image_file_ids_json TEXT,
    created_at DATETIME NOT NULL,
    INDEX idx_opfl_order_id (order_id)
);
