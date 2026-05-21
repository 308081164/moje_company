-- 与 Hibernate ddl-auto=validate 对齐：b2b_agent_session.status 须为 MySQL ENUM（见 V11 order_customer_view_link 同类修复）
ALTER TABLE b2b_agent_session
    MODIFY COLUMN status ENUM('ACTIVE', 'CLOSED', 'COMMITTED') NOT NULL DEFAULT 'ACTIVE'
        COMMENT 'ACTIVE/CLOSED/COMMITTED';
