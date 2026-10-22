ALTER TABLE order_production_follow_log
    ADD COLUMN process_code VARCHAR(32) NULL,
    ADD COLUMN piece_id BIGINT NULL;

CREATE TABLE production_process_photo (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    process_code VARCHAR(32) NOT NULL,
    file_id BIGINT NOT NULL,
    uploader_user_id BIGINT NOT NULL,
    matched_order_id BIGINT NULL,
    matched_piece_id BIGINT NULL,
    matched_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_ppp_pool (uploader_user_id, process_code, matched_at)
);
