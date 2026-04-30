-- ============================================
-- 系统优化功能数据库迁移脚本
-- 版本: V5
-- 创建日期: 2026-04-29
-- ============================================

USE moje_database;

-- ============================================
-- 1. 增强建模师工作状态表（使用兼容MySQL 8.0的方式）
-- ============================================
DELIMITER //

-- 添加 c2c_todo_count 列
CREATE PROCEDURE AddColumnIfNotExists()
BEGIN
    DECLARE col_exists INT;
    
    -- 检查 c2c_todo_count 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'c2c_todo_count';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN c2c_todo_count INT NOT NULL DEFAULT 0 COMMENT 'C端待办任务数';
    END IF;
    
    -- 检查 b2b_todo_count 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'b2b_todo_count';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN b2b_todo_count INT NOT NULL DEFAULT 0 COMMENT 'B端待办任务数';
    END IF;
    
    -- 检查 auto_assign_enabled 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'auto_assign_enabled';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN auto_assign_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否允许自动派单';
    END IF;
    
    -- 检查 last_priority_bonus_time 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'last_priority_bonus_time';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN last_priority_bonus_time DATETIME COMMENT '最后优先派单时间';
    END IF;
    
    -- 检查 reason_for_pause 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'reason_for_pause';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN reason_for_pause VARCHAR(500) COMMENT '暂停接单原因';
    END IF;
    
    -- 检查 last_activity_time 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'modeler_work_status' 
      AND column_name = 'last_activity_time';
    
    IF col_exists = 0 THEN
        ALTER TABLE modeler_work_status 
        ADD COLUMN last_activity_time DATETIME COMMENT '最后活动时间';
    END IF;
    
END //

DELIMITER ;

CALL AddColumnIfNotExists();
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- ============================================
-- 2. 订单表添加入派单时间和超时检测字段
-- ============================================
DELIMITER //

CREATE PROCEDURE AddOrderColumns()
BEGIN
    DECLARE col_exists INT;
    
    -- 检查 assigned_to_designer_at 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'orders' 
      AND column_name = 'assigned_to_designer_at';
    
    IF col_exists = 0 THEN
        ALTER TABLE orders 
        ADD COLUMN assigned_to_designer_at DATETIME COMMENT '分配设计师时间';
    END IF;
    
    -- 检查 assigned_to_modeler_at 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'orders' 
      AND column_name = 'assigned_to_modeler_at';
    
    IF col_exists = 0 THEN
        ALTER TABLE orders 
        ADD COLUMN assigned_to_modeler_at DATETIME COMMENT '分配建模师时间';
    END IF;
    
    -- 检查 last_reminder_sent_at 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'orders' 
      AND column_name = 'last_reminder_sent_at';
    
    IF col_exists = 0 THEN
        ALTER TABLE orders 
        ADD COLUMN last_reminder_sent_at DATETIME COMMENT '最后提醒发送时间';
    END IF;
    
END //

DELIMITER ;

CALL AddOrderColumns();
DROP PROCEDURE IF EXISTS AddOrderColumns;

-- ============================================
-- 3. 订单详情表添加上传文件备注字段
-- ============================================
DELIMITER //

CREATE PROCEDURE AddOrderDetailColumn()
BEGIN
    DECLARE col_exists INT;
    
    -- 检查 client_upload_notes 是否存在
    SELECT COUNT(*) INTO col_exists 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'order_details' 
      AND column_name = 'client_upload_notes';
    
    IF col_exists = 0 THEN
        ALTER TABLE order_details 
        ADD COLUMN client_upload_notes TEXT COMMENT '客户上传文件备注';
    END IF;
    
END //

DELIMITER ;

CALL AddOrderDetailColumn();
DROP PROCEDURE IF EXISTS AddOrderDetailColumn;

-- ============================================
-- 4. 任务流转记录表
-- ============================================
CREATE TABLE IF NOT EXISTS task_assignment_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    task_type VARCHAR(50) NOT NULL COMMENT '任务类型: DESIGN/MODEL',
    from_user_id BIGINT COMMENT '原处理人ID',
    to_user_id BIGINT COMMENT '新处理人ID',
    reassigned_by BIGINT COMMENT '重新分配人ID',
    reason TEXT COMMENT '重新分配原因',
    status VARCHAR(50) DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/CANCELLED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_order_id (order_id),
    INDEX idx_from_user (from_user_id),
    INDEX idx_to_user (to_user_id),
    INDEX idx_task_type (task_type),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务流转记录表';

-- ============================================
-- 5. 订单驳回流程表
-- ============================================
CREATE TABLE IF NOT EXISTS order_rejection_flows (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    rejected_by BIGINT NOT NULL COMMENT '驳回人ID',
    rejection_type VARCHAR(50) NOT NULL COMMENT '驳回类型: DESIGN/MODEL/REVIEW',
    rejection_reasons TEXT NOT NULL COMMENT '驳回原因',
    current_stage VARCHAR(50) DEFAULT 'PENDING_FIX' COMMENT '当前阶段: PENDING_FIX/IN_FIX/RESUBMITTED/REVIEWING',
    last_status_update_by BIGINT COMMENT '最后状态更新人',
    last_status_update_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '最后状态更新时间',
    resubmitted_at TIMESTAMP NULL COMMENT '重新提交时间',
    resolved_at TIMESTAMP NULL COMMENT '解决时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_order_id (order_id),
    INDEX idx_rejection_type (rejection_type),
    INDEX idx_current_stage (current_stage),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单驳回流程表';

-- ============================================
-- 6. 初始化现有建模师记录（补充字段）
-- ============================================
UPDATE modeler_work_status 
SET 
    c2c_todo_count = COALESCE(c2c_todo_count, todo_count), 
    b2b_todo_count = COALESCE(b2b_todo_count, 0),
    auto_assign_enabled = COALESCE(auto_assign_enabled, TRUE)
WHERE id > 0;

-- ============================================
-- 7. 系统配置表新增超时配置
-- ============================================
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES 
('task.timeout.warning.hours', '96', 'NUMBER', '超时警告时间(小时)'),
('task.timeout.force.stop.hours', '168', 'NUMBER', '强制停止派单时间(小时)'),
('task.auto.assign.enabled', 'true', 'BOOLEAN', '是否启用自动派单'),
('task.reassign.allowed', 'true', 'BOOLEAN', '是否允许任务重新分派');

SELECT '系统优化功能数据库迁移完成！' as message;