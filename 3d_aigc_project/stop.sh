#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "停止 3D AIGC Docker 服务..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.gpu.yml --profile full down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile full down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile full down 2>/dev/null || true
docker compose --profile full down 2>/dev/null || true
docker compose down 2>/dev/null || true

echo "已停止。"
