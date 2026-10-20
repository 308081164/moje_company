DROP TABLE IF EXISTS order_piece;
ALTER TABLE design_info DROP COLUMN piece_id;
ALTER TABLE modeling_info DROP COLUMN piece_id;
ALTER TABLE order_event DROP COLUMN piece_id;
DELETE FROM flyway_schema_history WHERE version='37';
