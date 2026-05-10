-- 建模效果图 URL 列表、建模师驳回给设计师的说明与附件 ID 列表
ALTER TABLE modeling_info
    ADD COLUMN model_effect_images JSON NULL COMMENT '效果图URL JSON 数组' AFTER model_notes,
    ADD COLUMN modeler_reject_to_designer_message TEXT NULL COMMENT '建模师最近一次驳回给设计师的文字说明' AFTER model_effect_images,
    ADD COLUMN modeler_reject_to_designer_file_ids JSON NULL COMMENT '驳回给设计师的附件文件 ID 数组' AFTER modeler_reject_to_designer_message;
