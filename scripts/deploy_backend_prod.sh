#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz
TAG="manual-$(date +%Y%m%d%H%M)"
echo "BUILD_TAG=$TAG"
docker build -t "jewelry-backend:$TAG" -f backend/Dockerfile backend
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export IMAGE_BACKEND="jewelry-backend:$TAG"
docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps backend
echo "DEPLOYED $TAG"
sleep 8
curl -fsS http://localhost:8851/api/actuator/health
echo
