#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
tar -xzf moje-deploy.tgz
# tar 解压不会删除本地已移除的文件，显式清理已下线页面
rm -f b2c-web/works.html
TAG="manual-$(date +%Y%m%d%H%M)"
echo "BUILD_TAG=$TAG"
docker build -t "moje-b2c-web:$TAG" -f b2c-web/Dockerfile b2c-web
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export IMAGE_B2C="moje-b2c-web:$TAG"
docker compose -f docker-compose.prod.yml -p moje up -d --pull never --force-recreate --no-deps b2c-web
echo "DEPLOYED $TAG"
curl -fsS -o /dev/null -w "b2c:%{http_code}\n" http://localhost:8853/
curl -fsS -o /tmp/listings.json http://localhost:8851/api/public/storefront/listings
python3 - <<'PY'
import json
d = json.load(open("/tmp/listings.json"))
print("listings", len(d), "covers", sum(1 for x in d if x.get("coverImageUrl")))
PY
