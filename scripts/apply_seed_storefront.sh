#!/usr/bin/env bash
# Apply seed_storefront_catalog.sql against the jewelry-mysql container on moje-new.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="${ROOT}/scripts/seed_storefront_catalog.sql"
if [[ ! -f "$SQL" ]]; then
  echo "missing $SQL" >&2
  exit 1
fi
cd /opt/moje
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
: "${DB_PASSWORD:?DB_PASSWORD missing}"
docker exec -i jewelry-mysql mysql -uroot -p"$DB_PASSWORD" moje_database < "$SQL"
echo "SEED_OK"
curl -fsS http://localhost:8851/api/public/storefront/listings -o /tmp/listings.json
python3 - <<'PY'
import json
d = json.load(open("/tmp/listings.json"))
print("published_count", len(d))
with_img = sum(1 for x in d if (x.get("coverImageUrl") or "").strip())
print("with_cover", with_img)
PY
