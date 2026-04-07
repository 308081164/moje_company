-- 修复 employee_work_statistics 视图中 role 字段类型
-- users.role 在表中是 ENUM，会导致 Hibernate schema-validation 期望 VARCHAR 但实际是 enum/CHAR。
-- 这里将 users.role 显式 CAST 为 CHAR(20)，使 JDBC 类型稳定为 CHAR。

DROP VIEW IF EXISTS employee_work_statistics;

CREATE VIEW employee_work_statistics AS
SELECT
    u.id as user_id,
    u.username,
    u.real_name,
    CAST(u.role AS CHAR(20)) as role,
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
GROUP BY u.id, u.username, u.real_name, CAST(u.role AS CHAR(20));

