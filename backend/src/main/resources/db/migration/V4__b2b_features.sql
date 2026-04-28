-- ============================================
-- B2B功能扩展数据库迁移脚本
-- 版本: V4
-- 创建日期: 2026-04-28
-- ============================================

USE moje_database;

-- ============================================
-- 1. B端客户表 (b2b_clients)
-- ============================================
CREATE TABLE b2b_clients (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '客户ID',
    contact VARCHAR(100) NOT NULL UNIQUE COMMENT '联系方式(手机号/微信)',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    company_name VARCHAR(100) COMMENT '公司名称',
    contact_person VARCHAR(100) COMMENT '联系人',
    email VARCHAR(255) COMMENT '邮箱',
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_contact (contact),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='B端客户表';

-- ============================================
-- 2. 建模师工作状态表 (modeler_work_status)
-- ============================================
CREATE TABLE modeler_work_status (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '状态ID',
    user_id BIGINT NOT NULL UNIQUE COMMENT '用户ID',
    work_mode ENUM('AUTO', 'B2B_ONLY', 'C2C_ONLY') DEFAULT 'AUTO' COMMENT '工作模式',
    status ENUM('AVAILABLE', 'PAUSED', 'BUSY') DEFAULT 'AVAILABLE' COMMENT '工作状态',
    todo_count INT NOT NULL DEFAULT 0 COMMENT '待办任务数',
    pause_reason VARCHAR(500) COMMENT '暂停原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_work_mode (work_mode),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建模师工作状态表';

-- ============================================
-- 3. 订单访问链接表 (order_access_links)
-- ============================================
CREATE TABLE order_access_links (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '链接ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    b2b_client_id BIGINT COMMENT 'B端客户ID',
    access_token VARCHAR(64) NOT NULL UNIQUE COMMENT '访问令牌',
    qrcode_data TEXT COMMENT '二维码Base64数据',
    status ENUM('ACTIVE', 'EXPIRED', 'DISABLED') DEFAULT 'ACTIVE' COMMENT '链接状态',
    expire_time TIMESTAMP COMMENT '过期时间',
    view_count INT DEFAULT 0 COMMENT '访问次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_order_id (order_id),
    INDEX idx_access_token (access_token),
    INDEX idx_status (status),
    INDEX idx_expire_time (expire_time),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (b2b_client_id) REFERENCES b2b_clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单访问链接表';

-- ============================================
-- 4. 订单表新增B2B标识字段
-- ============================================
ALTER TABLE orders ADD COLUMN is_b2b BOOLEAN DEFAULT FALSE COMMENT '是否B2B订单';

-- ============================================
-- 5. 插入系统配置项
-- ============================================
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('admin.reminder.email', '', 'STRING', '管理员提醒邮箱'),
('smtp.host', 'smtp.qq.com', 'STRING', 'SMTP服务器地址'),
('smtp.port', '587', 'STRING', 'SMTP端口'),
('smtp.username', '', 'STRING', 'SMTP用户名'),
('smtp.password', '', 'STRING', 'SMTP密码'),
('smtp.from', '', 'STRING', '发件人邮箱'),
('app.b2b.access-url-prefix', 'http://localhost:8851/api/b2b/order/', 'STRING', 'B2B订单访问链接前缀');

-- ============================================
-- 6. 为现有建模师初始化工作状态
-- ============================================
INSERT INTO modeler_work_status (user_id, work_mode, status, todo_count)
SELECT id, 'AUTO', 'AVAILABLE', 0 
FROM users 
WHERE role = 'MODELER' AND status = 'ACTIVE'
ON DUPLICATE KEY UPDATE user_id = user_id;

SELECT 'B2B功能扩展数据库迁移完成！' as message;