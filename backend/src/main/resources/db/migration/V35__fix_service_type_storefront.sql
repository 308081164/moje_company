-- 修复：V32 引入 ServiceType.STOREFRONT（独立站寄售复产单），但 V25 的 ENUM 未包含该值，
-- 导致商城购买下单在生产插入 orders 时 service_type 截断失败。
ALTER TABLE orders
    MODIFY COLUMN service_type ENUM('CUSTOM_IMAGE','DESIGNER_DESIGN','B2B_MODEL','STOREFRONT') NULL
    COMMENT 'CUSTOM_IMAGE/DESIGNER_DESIGN/B2B_MODEL/STOREFRONT';
