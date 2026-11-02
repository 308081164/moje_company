ALTER TABLE orders
    ADD COLUMN auto_publish_to_storefront TINYINT(1) NOT NULL DEFAULT 0 COMMENT '尾款支付时客户选择自动上架小店';
