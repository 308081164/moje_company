-- 建模备注（与前端 OrderModelUpdateRequest.modelNotes 对齐）
ALTER TABLE modeling_info ADD COLUMN model_notes TEXT NULL COMMENT '建模备注' AFTER model_files;
