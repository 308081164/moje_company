SELECT version, success, description FROM flyway_schema_history WHERE version IN ('37', '38') ORDER BY version;
SHOW TABLES LIKE 'design_info_version';
