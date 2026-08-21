-- 门户展示配置：B/C 端 scope 隔离 + 首页区块配置表

-- 站点配置加 scope（B端/C端各自一套）
ALTER TABLE portal_site_settings ADD COLUMN scope VARCHAR(1) NOT NULL DEFAULT 'B' COMMENT 'B端/C端' AFTER id;
UPDATE portal_site_settings SET scope = 'B' WHERE id = 1;
INSERT INTO portal_site_settings (id, scope) VALUES (2, 'C');

-- 珠宝分类加 scope
ALTER TABLE portal_jewelry_category ADD COLUMN scope VARCHAR(1) NOT NULL DEFAULT 'B' COMMENT 'B端/C端' AFTER id;
CREATE INDEX idx_portal_cat_scope ON portal_jewelry_category (scope, sort_order, id);

-- 首页区块配置（多语言文案 + 图片 + 元数据）
CREATE TABLE portal_home_block (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scope VARCHAR(1) NOT NULL COMMENT 'B端/C端',
    section VARCHAR(50) NOT NULL COMMENT 'hero/services/works/process/craft/haute/about/contact/cta',
    block_key VARCHAR(100) NOT NULL COMMENT '区块内唯一键',
    sort_order INT NOT NULL DEFAULT 0,
    content_json JSON NULL COMMENT 'texts(多语言)+imageFileIds+extra',
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_home_block (scope, section, block_key),
    INDEX idx_home_block_section (scope, section, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门户首页区块配置';
