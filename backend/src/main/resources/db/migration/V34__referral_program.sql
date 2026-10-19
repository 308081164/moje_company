-- C 端个人推广码：专属短码、下单绑定、5% 佣金钱包与模拟提现（与寄售钱包同构但语义独立）

CREATE TABLE referral_code (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    code VARCHAR(16) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    UNIQUE KEY uk_referral_code_code (code),
    UNIQUE KEY uk_referral_code_account (account_id)
) COMMENT 'C端门户用户专属推广码';

CREATE TABLE referral_binding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    referral_code_id BIGINT NOT NULL,
    referrer_account_id BIGINT NOT NULL,
    buyer_account_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    order_amount DECIMAL(12, 2) NOT NULL COMMENT '佣金计算基数（定制单定金/商城单售价）',
    commission_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.0500 COMMENT '佣金比例（统一 5%）',
    commission_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING待结算/SETTLED已结算/CANCELLED已取消',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at DATETIME NULL,
    UNIQUE KEY uk_referral_binding_order (order_id),
    KEY idx_referral_binding_referrer (referrer_account_id),
    KEY idx_referral_binding_buyer (buyer_account_id)
) COMMENT '推广码下单绑定与佣金记录';

CREATE TABLE referral_wallet (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_earned DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_withdrawn DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    UNIQUE KEY uk_referral_wallet_account (account_id)
) COMMENT '推广佣金钱包';

CREATE TABLE referral_wallet_txn (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    order_id BIGINT NULL,
    binding_id BIGINT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'HOLD待结算/SETTLE结算/WITHDRAW提现',
    amount DECIMAL(12, 2) NOT NULL,
    remark VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_referral_txn_account (account_id),
    KEY idx_referral_txn_order (order_id)
) COMMENT '推广佣金钱包流水';

CREATE TABLE referral_withdraw_request (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PAID',
    remark VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    KEY idx_referral_withdraw_account (account_id)
) COMMENT '推广佣金提现申请（当前为模拟即时到账）';
