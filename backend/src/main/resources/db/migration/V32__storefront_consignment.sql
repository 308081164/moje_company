-- 独立站寄售：完成设计/打样后的一键上架、买家下单、卖家钱包、员工复产发货

ALTER TABLE orders
    ADD COLUMN listing_id BIGINT NULL COMMENT '寄售商品ID' AFTER conversation_id,
    ADD COLUMN marketplace_seller_id BIGINT NULL COMMENT '寄售卖家门户账号ID' AFTER listing_id,
    ADD COLUMN sale_price DECIMAL(12, 2) NULL COMMENT '买家实付售价' AFTER marketplace_seller_id,
    ADD COLUMN production_fee DECIMAL(12, 2) NULL COMMENT '锁定的代工费' AFTER sale_price,
    ADD COLUMN shipping_fee DECIMAL(12, 2) NULL COMMENT '锁定的代邮费' AFTER production_fee,
    ADD COLUMN seller_payout DECIMAL(12, 2) NULL COMMENT '卖家应得（售价-代工-代邮）' AFTER shipping_fee;

CREATE TABLE storefront_listing (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_order_id BIGINT NOT NULL,
    seller_account_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    cover_image_url VARCHAR(1000) NULL,
    sale_price DECIMAL(12, 2) NOT NULL,
    production_fee_min DECIMAL(12, 2) NOT NULL,
    production_fee_max DECIMAL(12, 2) NOT NULL,
    shipping_fee_min DECIMAL(12, 2) NOT NULL,
    shipping_fee_max DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    sold_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    UNIQUE KEY uk_storefront_source_order (source_order_id),
    KEY idx_storefront_seller (seller_account_id),
    KEY idx_storefront_status (status)
) COMMENT 'C端独立站寄售商品';

CREATE TABLE seller_wallet (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_earned DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_withdrawn DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    UNIQUE KEY uk_seller_wallet_account (account_id)
) COMMENT '寄售卖家钱包';

CREATE TABLE seller_wallet_txn (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    listing_id BIGINT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    remark VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wallet_txn_account (account_id),
    KEY idx_wallet_txn_order (order_id)
) COMMENT '卖家钱包流水';

CREATE TABLE seller_withdraw_request (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PAID',
    remark VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    KEY idx_withdraw_account (account_id)
) COMMENT '卖家提现申请（当前为模拟即时到账）';

INSERT INTO system_config (config_key, config_value, config_type, description, is_editable, created_at, updated_at)
SELECT 'storefront.productionFeeMin', '180', 'NUMBER', '寄售代工费参考下限（USD）', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'storefront.productionFeeMin');

INSERT INTO system_config (config_key, config_value, config_type, description, is_editable, created_at, updated_at)
SELECT 'storefront.productionFeeMax', '680', 'NUMBER', '寄售代工费参考上限（USD）', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'storefront.productionFeeMax');

INSERT INTO system_config (config_key, config_value, config_type, description, is_editable, created_at, updated_at)
SELECT 'storefront.shippingFeeMin', '15', 'NUMBER', '寄售代邮费参考下限（USD）', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'storefront.shippingFeeMin');

INSERT INTO system_config (config_key, config_value, config_type, description, is_editable, created_at, updated_at)
SELECT 'storefront.shippingFeeMax', '45', 'NUMBER', '寄售代邮费参考上限（USD）', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'storefront.shippingFeeMax');
