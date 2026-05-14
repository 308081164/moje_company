-- 信息化数据归档师角色 + 建模材料归档表

ALTER TABLE users MODIFY COLUMN role ENUM(
    'ADMIN',
    'SALES_PRE',
    'SALES_MID',
    'DESIGNER',
    'MODELER',
    'FOLLOW_UP',
    'DATA_ARCHIVIST'
) NOT NULL COMMENT '角色';

CREATE TABLE order_modeling_archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    order_id BIGINT NOT NULL UNIQUE COMMENT '订单',
    main_structure_complexity INT NULL COMMENT '1普通构型 2异形构型 3无主体',
    main_marker_file_ids TEXT NULL COMMENT 'JSON: [fileId,...] 主体结构样式标记',
    texture_complexity INT NULL COMMENT '1不含纹理 2含纹理 3多种纹理',
    texture_marker_file_ids TEXT NULL COMMENT 'JSON: [fileId,...]',
    small_component_count INT NOT NULL DEFAULT 0 COMMENT '小组件条数',
    inlay_structure_count INT NOT NULL DEFAULT 0 COMMENT '镶嵌结构条数',
    components_json MEDIUMTEXT NULL COMMENT 'JSON: [{complexity,markerFileIds:[]}]',
    inlays_json MEDIUMTEXT NULL COMMENT 'JSON: [{complexity,markerFileIds:[]}]',
    completed_at DATETIME NULL COMMENT '首次提交归档锁定时间',
    completed_by_user_id BIGINT NULL COMMENT '首次提交人',
    last_saved_by_user_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_oma_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_oma_completed_by FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_oma_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建模材料归档（三角色共享池，首次提交后锁定再次提交）';
