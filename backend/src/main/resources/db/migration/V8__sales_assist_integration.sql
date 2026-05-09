-- 企业微信客户群「加入群聊」配置与二维码（异步任务写入）
ALTER TABLE orders
    ADD COLUMN wecom_join_config_id VARCHAR(128) NULL COMMENT '企微进群方式 config_id' AFTER last_reminder_sent_at,
    ADD COLUMN wecom_join_qr_base64 MEDIUMTEXT NULL COMMENT '进群二维码图片 Base64' AFTER wecom_join_config_id,
    ADD COLUMN wecom_join_error VARCHAR(1000) NULL COMMENT '企微自动进群失败原因' AFTER wecom_join_qr_base64;
