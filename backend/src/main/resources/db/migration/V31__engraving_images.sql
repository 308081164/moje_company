-- 字印支持多图（最多 5 张），图片 URL 列表以 JSON 存储
ALTER TABLE order_details ADD COLUMN engraving_images JSON NULL COMMENT '字印图片 URL 列表';
