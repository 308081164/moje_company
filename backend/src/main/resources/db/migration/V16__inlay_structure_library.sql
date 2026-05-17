-- 镶嵌结构库：删除审计（每日限额）
CREATE TABLE inlay_structure_delete_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    oss_object_key VARCHAR(1024) NOT NULL,
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inlay_del_user_time (user_id, deleted_at)
);
