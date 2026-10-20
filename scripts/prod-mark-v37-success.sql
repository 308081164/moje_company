INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success)
SELECT COALESCE(MAX(installed_rank), 0) + 1, '37', 'order pieces', 'SQL', 'V37__order_pieces.sql', NULL, 'manual', NOW(6), 0, 1
FROM flyway_schema_history;
