#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz
TAG="manual-$(date +%Y%m%d%H%M)"
echo "BUILD_TAG=$TAG"
docker build -t "jewelry-backend:$TAG" -f backend/Dockerfile backend
docker build -t "moje-b2c-web:$TAG" -f b2c-web/Dockerfile b2c-web
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export IMAGE_BACKEND="jewelry-backend:$TAG"
export IMAGE_B2C="moje-b2c-web:$TAG"
docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps backend b2c-web
echo "DEPLOYED $TAG"
sleep 8
curl -fsS http://localhost:8851/api/actuator/health
echo
curl -fsS -o /dev/null -w "b2c:%{http_code}\n" http://localhost:8853/
curl -fsS -o /dev/null -w "workspace:%{http_code}\n" http://localhost:8853/order-workspace.html
