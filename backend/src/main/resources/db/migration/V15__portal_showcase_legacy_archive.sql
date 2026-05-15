-- 门户独立素材（轮播/企业图等）可写入 files.related_type=PORTAL
ALTER TABLE files MODIFY COLUMN related_type ENUM('ORDER', 'DESIGN', 'MODEL', 'OTHER', 'PORTAL') DEFAULT 'OTHER' COMMENT '关联类型';

-- 对外站点文案与轮播等（单行配置 id=1）
CREATE TABLE portal_site_settings (
    id BIGINT NOT NULL PRIMARY KEY COMMENT '固定为 1',
    hero_title VARCHAR(200) NULL,
    hero_subtitle VARCHAR(500) NULL,
    about_html MEDIUMTEXT NULL COMMENT '关于我们富文本或 HTML',
    business_hours VARCHAR(500) NULL COMMENT '营业时间文案',
    contact_phone VARCHAR(100) NULL,
    contact_wechat VARCHAR(200) NULL,
    contact_email VARCHAR(200) NULL,
    address VARCHAR(500) NULL,
    carousel_file_ids TEXT NULL COMMENT 'JSON: [fileId,...] 轮播图',
    company_photo_file_ids TEXT NULL COMMENT 'JSON: [fileId,...] 企业实拍',
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='B端门户站点配置';

INSERT INTO portal_site_settings (id) VALUES (1);

-- 珠宝分类（门户产品子栏目）
CREATE TABLE portal_jewelry_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL COMMENT 'URL 段',
    name_cn VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_portal_cat_slug (slug),
    INDEX idx_portal_cat_sort (sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门户珠宝分类';

INSERT INTO portal_jewelry_category (slug, name_cn, name_en, sort_order, enabled) VALUES
('rings', '戒指', 'Rings', 10, 1),
('necklaces', '项链', 'Necklaces', 20, 1),
('earrings', '耳饰', 'Earrings', 30, 1),
('bracelets', '手镯', 'Bracelets', 40, 1),
('bespoke', '高级定制', 'Bespoke', 50, 1);

-- 分类下对外展示的素材（引用订单内已上传 OSS 的 files 记录）
CREATE TABLE portal_showcase_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    caption VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    published TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_portal_showcase_cat_file (category_id, file_id),
    INDEX idx_portal_showcase_cat_sort (category_id, sort_order, id),
    CONSTRAINT fk_psi_category FOREIGN KEY (category_id) REFERENCES portal_jewelry_category(id) ON DELETE CASCADE,
    CONSTRAINT fk_psi_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门户分类橱窗素材';

-- 历史订单归档（线下数据录入）
CREATE TABLE legacy_order_archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    archive_code VARCHAR(64) NOT NULL COMMENT '归档编号',
    segment ENUM('B2B', 'C2C', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN' COMMENT 'B端/C端',
    customer_name VARCHAR(200) NULL,
    customer_phone VARCHAR(64) NULL,
    customer_wechat VARCHAR(200) NULL,
    order_date DATE NULL,
    completed_date DATE NULL,
    style_summary VARCHAR(500) NULL,
    material_summary VARCHAR(500) NULL,
    requirements MEDIUMTEXT NULL,
    design_notes MEDIUMTEXT NULL,
    modeling_notes MEDIUMTEXT NULL,
    quotation_notes MEDIUMTEXT NULL,
    attachments_json MEDIUMTEXT NULL COMMENT 'JSON: [{name,url}]',
    internal_remark MEDIUMTEXT NULL,
    created_by_user_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_legacy_archive_code (archive_code),
    INDEX idx_legacy_seg (segment, created_at),
    INDEX idx_legacy_customer (customer_name),
    CONSTRAINT fk_legacy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='历史订单归档';
