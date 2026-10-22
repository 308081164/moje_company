ALTER TABLE order_piece
    ADD COLUMN jewelry_type VARCHAR(32) NULL COMMENT '珠宝类型：RING/NECKLACE/EARRING/BROOCH/BRACELET/OTHER';

ALTER TABLE storefront_listing
    ADD COLUMN jewelry_type VARCHAR(32) NULL COMMENT '上架商品类型（筛选与下单规格）';

CREATE INDEX idx_storefront_listing_jewelry_type ON storefront_listing (jewelry_type);
