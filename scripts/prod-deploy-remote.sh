#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz

if [ -f .env ]; then
  ENV_TMP="$(mktemp)"
  sed 's/\r$//' .env > "$ENV_TMP"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_TMP"
  set +a
  rm -f "$ENV_TMP"
fi

TAG="manual-$(date +%Y%m%d%H%M)"
echo "=== Building images: $TAG ==="
docker build -t "jewelry-backend:${TAG}" -f backend/Dockerfile backend
docker build -t "moje-b2c-web:${TAG}" -f b2c-web/Dockerfile b2c-web
docker build -t "moje-staff-web:${TAG}" -f frontend/Dockerfile.static frontend
export IMAGE_BACKEND="jewelry-backend:${TAG}"
export IMAGE_B2C="moje-b2c-web:${TAG}"
export IMAGE_STAFF="moje-staff-web:${TAG}"
# B2B 沿用现网镜像，避免本机 docker build 权限问题
export IMAGE_B2B="${IMAGE_B2B:-ghcr.io/308081164/moje_company/moje-b2b-client:latest}"

COMPOSE="docker compose -f docker-compose.prod.yml -p moje"
$COMPOSE up -d --pull never --force-recreate backend b2c-web staff-web

echo "=== Health checks ==="
ok=0
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:8851/api/actuator/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  echo "backend health retry $i/30"
  sleep 5
done
if [ "$ok" != "1" ]; then
  echo "backend health FAILED"
  docker logs jewelry-backend --tail 80 || true
  exit 1
fi
curl -fsS "http://localhost:8851/api/actuator/health"
echo
curl -fsS -o /dev/null -w "b2c HTTP %{http_code}\n" "http://localhost:8853/"
curl -fsS -o /dev/null -w "b2b HTTP %{http_code}\n" "http://localhost:8852/"
docker ps --filter name=jewelry-backend --filter name=moje-b2c --filter name=moje-b2b --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo "=== Deploy done: $TAG ==="
