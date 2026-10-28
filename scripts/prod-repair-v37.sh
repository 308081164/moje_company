#!/bin/bash
set -euo pipefail
source /opt/moje/.env
MYSQL=(docker exec jewelry-mysql mysql -uroot -p"${DB_PASSWORD}" moje_database)

echo "=== cleanup failed V37 ==="
"${MYSQL[@]}" -e "DROP TABLE IF EXISTS order_piece;"
"${MYSQL[@]}" -e "ALTER TABLE design_info DROP COLUMN piece_id;" 2>/dev/null || true
"${MYSQL[@]}" -e "ALTER TABLE modeling_info DROP COLUMN piece_id;" 2>/dev/null || true
"${MYSQL[@]}" -e "ALTER TABLE order_event DROP COLUMN piece_id;" 2>/dev/null || true
"${MYSQL[@]}" -e "DELETE FROM flyway_schema_history WHERE version='37';"
echo "done"
