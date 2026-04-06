-- ============================================
-- 珠宝定制系统数据库初始化脚本
-- 版本: V1
-- 创建日期: 2026-04-06
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS moje_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE moje_database;

-- ============================================
-- 1. 用户表 (users)
-- ============================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    role ENUM('ADMIN', 'SALES_PRE', 'SALES_MID', 'DESIGNER', 'MODELER', 'FOLLOW_UP') NOT NULL COMMENT '角色',
    real_name VARCHAR(100) COMMENT '真实姓名',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 2. 订单表 (orders)
-- ============================================
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_number VARCHAR(50) NOT NULL UNIQUE COMMENT '订单编号',
    customer_name VARCHAR(100) COMMENT '客户姓名',
    customer_phone VARCHAR(20) COMMENT '客户电话',
    customer_wechat VARCHAR(100) COMMENT '客户微信',
    source ENUM('DOUYIN', 'BILIBILI', 'XIAOHONGSHU', 'TAOBAO', 'XIANYU', 'INFLUENCER') NOT NULL COMMENT '来源',
    influencer_name VARCHAR(100) COMMENT '达人昵称',
    deposit DECIMAL(10, 2) DEFAULT 0.00 COMMENT '定金金额',
    basic_requirements TEXT COMMENT '基础需求',
    style_info TEXT COMMENT '款式信息',
    material_info TEXT COMMENT '材质信息',
    status ENUM(
        'PENDING_DESIGN',      -- 待设计师设计
        'DESIGNING',           -- 设计中
        'PENDING_MODEL',       -- 待建模师设计
        'MODELING',            -- 建模中
        'PENDING_REVIEW',      -- 待工艺验证
        'PENDING_PRODUCTION',  -- 待生产
        'PRODUCING',           -- 生产中
        'COMPLETED',           -- 已完成
        'CANCELLED'            -- 已取消
    ) DEFAULT 'PENDING_DESIGN' COMMENT '订单状态',
    
    -- 关联人员
    sales_pre_id BIGINT COMMENT '售前客服ID',
    sales_mid_id BIGINT COMMENT '售中客服ID',
    designer_id BIGINT COMMENT '设计师ID',
    modeler_id BIGINT COMMENT '建模师ID',
    follow_up_id BIGINT COMMENT '跟单员ID',
    
    -- 时间信息
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    design_completed_time TIMESTAMP NULL COMMENT '设计完成时间',
    model_completed_time TIMESTAMP NULL COMMENT '建模完成时间',
    review_completed_time TIMESTAMP NULL COMMENT '评审完成时间',
    production_start_time TIMESTAMP NULL COMMENT '生产开始时间',
    production_completed_time TIMESTAMP NULL COMMENT '生产完成时间',
    cancelled_time TIMESTAMP NULL COMMENT '取消时间',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 外键约束
    FOREIGN KEY (sales_pre_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sales_mid_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (designer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (modeler_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (follow_up_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- 索引
    INDEX idx_order_number (order_number),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_customer_phone (customer_phone),
    INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- ============================================
-- 3. 订单详情表 (order_details)
-- ============================================
CREATE TABLE order_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '详情ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    
    -- 字印信息
    engraving_text VARCHAR(500) COMMENT '字印内容',
    
    -- 材质信息
    material_type VARCHAR(50) COMMENT '材质类型',
    material_weight DECIMAL(10, 3) COMMENT '材质重量(克)',
    material_unit_price DECIMAL(10, 2) COMMENT '材质单价',
    material_total_price DECIMAL(10, 2) COMMENT '材质总价',
    
    -- 尺寸信息
    hand_size VARCHAR(50) COMMENT '手寸',
    chain_length VARCHAR(50) COMMENT '链长',
    
    -- 设计信息
    design_notes TEXT COMMENT '设计说明',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单详情表';

-- ============================================
-- 4. 设计信息表 (design_info)
-- ============================================
CREATE TABLE design_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '设计ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    
    -- 工艺信息
    process_info JSON COMMENT '工艺信息JSON',
    
    -- 石料信息
    stone_info JSON COMMENT '石料信息JSON',
    
    -- 设计图信息
    design_images JSON COMMENT '设计图JSON数组',
    
    -- 状态
    is_customer_approved BOOLEAN DEFAULT FALSE COMMENT '客户是否确认',
    approval_time TIMESTAMP NULL COMMENT '确认时间',
    approval_notes TEXT COMMENT '确认备注',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_is_customer_approved (is_customer_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设计信息表';

-- ============================================
-- 5. 建模信息表 (modeling_info)
-- ============================================
CREATE TABLE modeling_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '建模ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    
    -- 克重信息
    weight DECIMAL(10, 3) COMMENT '克重(克)',
    
    -- 建模文件信息
    model_files JSON COMMENT '建模文件JSON数组',
    
    -- 状态
    is_customer_approved BOOLEAN DEFAULT FALSE COMMENT '客户是否确认',
    approval_time TIMESTAMP NULL COMMENT '确认时间',
    approval_notes TEXT COMMENT '确认备注',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_is_customer_approved (is_customer_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='建模信息表';

-- ============================================
-- 6. 工艺评审表 (process_review)
-- ============================================
CREATE TABLE process_review (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '评审ID',
    order_id BIGINT NOT NULL COMMENT '订单ID',
    reviewer_id BIGINT NOT NULL COMMENT '评审员ID',
    
    -- 评审信息
    review_result ENUM('PASSED', 'REJECTED') COMMENT '评审结果',
    rejected_reasons TEXT COMMENT '驳回原因',
    review_notes TEXT COMMENT '评审备注',
    
    -- 删除的工艺信息
    deleted_processes JSON COMMENT '删除的工艺JSON',
    
    review_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评审时间',
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_review_result (review_result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺评审表';

-- ============================================
-- 7. 报价表 (quotation)
-- ============================================
CREATE TABLE quotation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '报价ID',
    order_id BIGINT NOT NULL UNIQUE COMMENT '订单ID',
    
    -- 工费信息
    labor_cost DECIMAL(10, 2) DEFAULT 0.00 COMMENT '工费',
    additional_labor_cost DECIMAL(10, 2) DEFAULT 0.00 COMMENT '额外工费',
    
    -- 增值服务
    has_design_copyright BOOLEAN DEFAULT FALSE COMMENT '是否设计买断',
    design_copyright_fee DECIMAL(10, 2) DEFAULT 0.00 COMMENT '设计买断费用',
    has_appraisal_certificate BOOLEAN DEFAULT FALSE COMMENT '是否申请鉴定证书',
    appraisal_certificate_fee DECIMAL(10, 2) DEFAULT 0.00 COMMENT '鉴定证书费用',
    is_confidential BOOLEAN DEFAULT FALSE COMMENT '是否保密不宣传',
    
    -- 其他费用
    other_fees DECIMAL(10, 2) DEFAULT 0.00 COMMENT '其他费用',
    other_notes TEXT COMMENT '其他备注',
    
    -- 总计
    subtotal DECIMAL(10, 2) DEFAULT 0.00 COMMENT '小计',
    total_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT '总计',
    
    -- 报价状态
    is_finalized BOOLEAN DEFAULT FALSE COMMENT '是否已最终确定',
    finalized_time TIMESTAMP NULL COMMENT '确定时间',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_is_finalized (is_finalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价表';

-- ============================================
-- 8. 系统配置表 (system_config)
-- ============================================
CREATE TABLE system_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY') DEFAULT 'STRING' COMMENT '配置类型',
    description VARCHAR(500) COMMENT '描述',
    is_editable BOOLEAN DEFAULT TRUE COMMENT '是否可编辑',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- ============================================
-- 9. 工艺配置表 (process_config)
-- ============================================
CREATE TABLE process_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '工艺ID',
    process_name VARCHAR(100) NOT NULL UNIQUE COMMENT '工艺名称',
    default_fee DECIMAL(10, 2) DEFAULT 0.00 COMMENT '默认工费',
    description TEXT COMMENT '工艺描述',
    is_available BOOLEAN DEFAULT TRUE COMMENT '是否可用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_process_name (process_name),
    INDEX idx_is_available (is_available),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺配置表';

-- ============================================
-- 10. 材质配置表 (material_config)
-- ============================================
CREATE TABLE material_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '材质ID',
    material_name VARCHAR(100) NOT NULL UNIQUE COMMENT '材质名称',
    material_code VARCHAR(50) NOT NULL UNIQUE COMMENT '材质代码',
    price_formula VARCHAR(500) COMMENT '价格计算公式',
    description TEXT COMMENT '材质描述',
    is_available BOOLEAN DEFAULT TRUE COMMENT '是否可用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_material_name (material_name),
    INDEX idx_material_code (material_code),
    INDEX idx_is_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='材质配置表';

-- ============================================
-- 11. 文件表 (files)
-- ============================================
CREATE TABLE files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '文件ID',
    file_name VARCHAR(255) NOT NULL COMMENT '文件名',
    original_name VARCHAR(255) COMMENT '原始文件名',
    file_path VARCHAR(500) COMMENT '文件路径',
    file_url VARCHAR(500) COMMENT '文件URL',
    file_size BIGINT COMMENT '文件大小(字节)',
    file_type VARCHAR(100) COMMENT '文件类型',
    file_extension VARCHAR(50) COMMENT '文件扩展名',
    
    -- 关联信息
    related_type ENUM('ORDER', 'DESIGN', 'MODEL', 'OTHER') DEFAULT 'OTHER' COMMENT '关联类型',
    related_id BIGINT COMMENT '关联ID',
    
    uploader_id BIGINT COMMENT '上传者ID',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_related_type (related_type, related_id),
    INDEX idx_uploader_id (uploader_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件表';

-- ============================================
-- 12. 操作日志表 (operation_logs)
-- ============================================
CREATE TABLE operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    user_id BIGINT COMMENT '用户ID',
    username VARCHAR(50) COMMENT '用户名',
    operation_type VARCHAR(100) NOT NULL COMMENT '操作类型',
    operation_target VARCHAR(100) COMMENT '操作目标',
    target_id BIGINT COMMENT '目标ID',
    operation_details TEXT COMMENT '操作详情',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_operation_type (operation_type),
    INDEX idx_created_at (created_at),
    INDEX idx_target (operation_target, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- ============================================
-- 初始化数据
-- ============================================

-- 插入默认管理员用户
INSERT INTO users (username, password, role, real_name, status) VALUES
('kuangjun', '$2a$10$YourHashedPasswordHere', 'ADMIN', '系统管理员', 'ACTIVE');

-- 插入默认工艺配置
INSERT INTO process_config (process_name, default_fee, description, sort_order) VALUES
('珐琅', 200.00, '珐琅工艺', 1),
('拉丝', 150.00, '拉丝工艺', 2),
('喷砂', 180.00, '喷砂工艺', 3),
('钉砂', 220.00, '钉砂工艺', 4);

-- 插入默认材质配置
INSERT INTO material_config (material_name, material_code, price_formula, description, sort_order) VALUES
('925银', 'SILVER_925', '大盘价 * 1.035', '925银材质', 1),
('足印', 'SILVER_PURE', '大盘价 * 1.05', '足印材质', 2),
('足金', 'GOLD_PURE', '大盘价 + 10', '足金材质', 3),
('K金', 'GOLD_K', '大盘价 * 1.08', 'K金材质', 4);

-- 插入系统配置
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('system.name', '珠宝定制管理系统', 'STRING', '系统名称'),
('system.version', '1.0.0', 'STRING', '系统版本'),
('order.number.prefix', 'JZ', 'STRING', '订单编号前缀'),
('order.auto.generate', 'true', 'BOOLEAN', '是否自动生成订单编号'),
('price.silver.margin', '0.035', 'NUMBER', '银价加价比例'),
('price.gold.margin', '10', 'NUMBER', '金价加价金额'),
('price.design.copyright.fee', '500', 'NUMBER', '设计买断费用'),
('price.appraisal.certificate.fee', '300', 'NUMBER', '鉴定证书费用'),
('security.password.default', '123456', 'STRING', '默认用户密码'),
('security.password.min.length', '6', 'NUMBER', '密码最小长度'),
('file.upload.max.size', '104857600', 'NUMBER', '文件上传最大大小(100MB)'),
('file.allowed.extensions', '.jpg,.jpeg,.png,.gif,.bmp,.pdf,.stl,.obj,.jad', 'STRING', '允许的文件扩展名');

-- 创建视图：员工工作统计视图
CREATE VIEW employee_work_statistics AS
SELECT 
    u.id as user_id,
    u.username,
    u.real_name,
    u.role,
    COUNT(DISTINCT CASE WHEN o.status = 'PENDING_DESIGN' AND o.sales_mid_id = u.id THEN o.id END) as pending_design_count,
    COUNT(DISTINCT CASE WHEN o.status = 'DESIGNING' AND o.designer_id = u.id THEN o.id END) as designing_count,
    COUNT(DISTINCT CASE WHEN o.status = 'PENDING_MODEL' AND o.modeler_id = u.id THEN o.id END) as pending_model_count,
    COUNT(DISTINCT CASE WHEN o.status = 'MODELING' AND o.modeler_id = u.id THEN o.id END) as modeling_count,
    COUNT(DISTINCT CASE WHEN o.status = 'PENDING_REVIEW' AND o.follow_up_id = u.id THEN o.id END) as pending_review_count,
    COUNT(DISTINCT CASE WHEN o.status IN ('COMPLETED', 'PRODUCING') AND 
        (o.sales_mid_id = u.id OR o.designer_id = u.id OR o.modeler_id = u.id OR o.follow_up_id = u.id) 
        THEN o.id END) as completed_this_week_count,
    COUNT(DISTINCT CASE WHEN DATE(o.created_at) = CURDATE() AND o.sales_pre_id = u.id THEN o.id END) as today_new_orders
FROM users u
LEFT JOIN orders o ON u.id IN (o.sales_pre_id, o.sales_mid_id, o.designer_id, o.modeler_id, o.follow_up_id)
WHERE u.status = 'ACTIVE'
GROUP BY u.id, u.username, u.real_name, u.role;

-- 创建视图：订单统计视图
CREATE VIEW order_statistics AS
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN status = 'PENDING_DESIGN' THEN 1 END) as pending_design,
    COUNT(CASE WHEN status = 'DESIGNING' THEN 1 END) as designing,
    COUNT(CASE WHEN status = 'PENDING_MODEL' THEN 1 END) as pending_model,
    COUNT(CASE WHEN status = 'MODELING' THEN 1 END) as modeling,
    COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END) as pending_review,
    COUNT(CASE WHEN status = 'PENDING_PRODUCTION' THEN 1 END) as pending_production,
    COUNT(CASE WHEN status = 'PRODUCING' THEN 1 END) as producing,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
    SUM(deposit) as total_deposit
FROM orders
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- 输出完成信息
SELECT '数据库初始化完成！' as message;
