#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz
# 确认源码已含修复
if ! grep -q '工作状态表可能混入非建模师' backend/src/main/java/com/jewelry/system/service/AutoAssignmentService.java; then
  echo "ERROR: source missing fix marker"
  exit 1
fi
TAG="manual-$(date +%Y%m%d%H%M)-modelerfix"
echo "BUILD_TAG=$TAG"
docker build --no-cache -t "jewelry-backend:$TAG" -f backend/Dockerfile backend
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export IMAGE_BACKEND="jewelry-backend:$TAG"
docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps backend
echo "DEPLOYED $TAG"
sleep 15
curl -fsS http://localhost:8851/api/actuator/health
echo
# 员工端静态站（含下拉兜底文案）
if [[ -f frontend/Dockerfile.static ]]; then
  STAFF_TAG="manual-$(date +%Y%m%d%H%M)-staff"
  docker build -t "moje-staff-web:$STAFF_TAG" -f frontend/Dockerfile.static frontend
  export IMAGE_STAFF="moje-staff-web:$STAFF_TAG"
  docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps staff-web
  echo "STAFF $STAFF_TAG"
fi
