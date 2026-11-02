#!/usr/bin/env bash
set -euo pipefail
sleep 2
curl -fsS http://localhost:8851/api/actuator/health || true
echo
MYSQL_CTR=jewelry-mysql
MYSQL_ROOT_PASSWORD="$(docker exec "$MYSQL_CTR" printenv MYSQL_ROOT_PASSWORD)"
DB_NAME="$(docker exec "$MYSQL_CTR" printenv MYSQL_DATABASE || true)"
if [ -z "${DB_NAME:-}" ]; then
  DB_NAME="$(docker exec "$MYSQL_CTR" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e 'SHOW DATABASES;' | grep -Ev 'information_schema|performance_schema|mysql|sys' | head -1)"
fi
echo "Using database: $DB_NAME"
run_sql() {
  docker exec -i "$MYSQL_CTR" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME"
}
echo "=== before cleanup: invalid modeler_id ==="
run_sql <<SQL
SELECT o.id,o.order_number,o.modeler_id,u.username,u.role
FROM orders o LEFT JOIN users u ON u.id=o.modeler_id
WHERE o.modeler_id IS NOT NULL AND (u.id IS NULL OR u.role <> 'MODELER' OR u.status <> 'ACTIVE');
SQL
echo "=== before cleanup: invalid work status ==="
run_sql <<SQL
SELECT m.user_id,u.username,u.role
FROM modeler_work_status m LEFT JOIN users u ON u.id=m.user_id
WHERE u.id IS NULL OR u.role <> 'MODELER';
SQL
run_sql < /tmp/cleanup_invalid_modeler.sql
echo CLEANUP_OK
echo "=== after cleanup: remaining invalid ==="
run_sql <<SQL
SELECT o.id,o.order_number,o.modeler_id,u.username,u.role
FROM orders o LEFT JOIN users u ON u.id=o.modeler_id
WHERE o.modeler_id IS NOT NULL AND (u.id IS NULL OR u.role <> 'MODELER' OR u.status <> 'ACTIVE');
SELECT m.user_id,u.username,u.role
FROM modeler_work_status m LEFT JOIN users u ON u.id=m.user_id
WHERE u.id IS NULL OR u.role <> 'MODELER';
SQL
