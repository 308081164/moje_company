-- 跟单人民币报价 → 客户美元支付：保留换算与优惠明细
ALTER TABLE quotation
    ADD COLUMN staff_amount_cny DECIMAL(12, 2) NULL COMMENT '跟单录入的人民币报价' AFTER total_amount,
    ADD COLUMN fx_cny_per_usd DECIMAL(12, 4) NULL COMMENT '换算时使用的人民币/美元汇率' AFTER staff_amount_cny,
    ADD COLUMN usd_before_discount DECIMAL(12, 2) NULL COMMENT '换算后、优惠前的美元金额' AFTER fx_cny_per_usd,
    ADD COLUMN publicity_discount_usd DECIMAL(12, 2) NULL COMMENT '公开宣传限时优惠（美元）' AFTER usd_before_discount;

INSERT INTO system_config (config_key, config_value, config_type, description, is_editable, created_at, updated_at)
SELECT 'fx.cnyPerUsd', '7.20', 'NUMBER', '人民币对美元汇率（1美元=多少人民币）', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE config_key = 'fx.cnyPerUsd');
