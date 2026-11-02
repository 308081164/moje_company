#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz
TAG="manual-$(date +%Y%m%d%H%M)-staff"
docker build -t "moje-staff-web:$TAG" -f frontend/Dockerfile.static frontend
export IMAGE_STAFF="moje-staff-web:$TAG"
docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps staff-web
echo "STAFF $TAG"
curl -fsS -o /dev/null -w "staff:%{http_code}\n" http://localhost:8854/ || true
curl -fsS http://localhost:8851/api/actuator/health
echo
