-- 单件尺寸按 piece 落在 design_info，避免订单级 hand_size 把多件尺寸拼到每一件上展示
ALTER TABLE design_info
    ADD COLUMN hand_size VARCHAR(120) NULL COMMENT '该单件手寸/规格（客户问卷或设计师填写）';
