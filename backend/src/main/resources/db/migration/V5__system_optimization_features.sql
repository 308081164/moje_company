-- ============================================
-- 系统优化功能数据库迁移脚本
-- 版本: V5
-- 创建日期: 2026-04-29
-- ============================================

USE moje_database;

-- ============================================
-- 1. 增强建模师工作状态表
-- ============================================
ALTER TABLE modeler_work_status 
ADD COLUMN IF NOT EXISTS c2c_todo_count INT NOT NULL DEFAULT 0 COMMENT 'C端待办任务数',
ADD COLUMN IF NOT EXISTS b2b_todo_count INT NOT NULL DEFAULT 0 COMMENT 'B端待办任务数',
ADD COLUMN IF NOT EXISTS auto_assign_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否允许自动派单',
ADD COLUMN IF NOT EXISTS last_priority_bonus_time DATETIME COMMENT '最后优先派单时间',
ADD COLUMN IF NOT EXISTS reason_for_pause VARCHAR(500) COMMENT '暂停接单原因',
ADD COLUMN IF NOT EXISTS last_activity_time DATETIME COMMENT '最后活动时间';

-- ============================================
-- 2. 订单表添加入派单时间和超时检测字段
-- ============================================
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assigned_to_designer_at DATETIME COMMENT '分配设计师时间',
ADD COLUMN IF NOT EXISTS assigned_to_modeler_at DATETIME COMMENT '分配建模师时间',
ADD COLUMN IF NOT EXISTS last_reminder_sent_at DATETIME COMMENT '最后提醒发送时间';

-- ============================================
-- 3. 任务流转记录表
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
-- 4. 订单驳回流程表
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
-- 5. B端客户上传文件增强
-- ============================================
ALTER TABLE order_details 
ADD COLUMN IF NOT EXISTS client_upload_notes TEXT COMMENT '客户上传文件备注';

-- ============================================
-- 6. 初始化现有建模师记录（补充字段）
-- ============================================
UPDATE modeler_work_status 
SET 
    c2c_todo_count = todo_count, 
    b2b_todo_count = 0,
    auto_assign_enabled = TRUE
WHERE c2c_todo_count IS NULL;

-- ============================================
-- 7. 系统配置表新增超时配置
-- ============================================
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES 
('task.timeout.warning.hours', '96', 'NUMBER', '超时警告时间(小时)'),
('task.timeout.force.stop.hours', '168', 'NUMBER', '强制停止派单时间(小时)'),
('task.auto.assign.enabled', 'true', 'BOOLEAN', '是否启用自动派单'),
('task.reassign.allowed', 'true', 'BOOLEAN', '是否允许任务重新分派');

SELECT '系统优化功能数据库迁移完成！' as message;
