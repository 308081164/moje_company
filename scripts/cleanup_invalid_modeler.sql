-- 清理误写入的非建模师 modeler_id，以及非建模师的接单工作状态行
-- 根因：modeler_work_status 曾对任意登录员工建行，自动派单未校验角色，把跟单员等写进 orders.modeler_id

UPDATE orders o
LEFT JOIN users u ON u.id = o.modeler_id
SET o.modeler_id = NULL,
    o.assigned_to_modeler_at = NULL
WHERE o.modeler_id IS NOT NULL
  AND (u.id IS NULL OR u.role <> 'MODELER' OR u.status <> 'ACTIVE');

DELETE m FROM modeler_work_status m
LEFT JOIN users u ON u.id = m.user_id
WHERE u.id IS NULL OR u.role <> 'MODELER';
