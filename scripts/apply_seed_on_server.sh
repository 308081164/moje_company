#!/usr/bin/env bash
set -euo pipefail
cd /opt/moje
set -a
# shellcheck disable=SC1091
. ./.env
set +a
docker exec -i jewelry-mysql mysql -uroot -p"${DB_PASSWORD}" moje_database < /tmp/seed_storefront_catalog.sql
echo SEED_SQL_DONE
curl -fsS -o /tmp/listings.json http://localhost:8851/api/public/storefront/listings
python3 <<'PY'
import json
d = json.load(open("/tmp/listings.json"))
print("published_count", len(d))
print("with_cover", sum(1 for x in d if (x.get("coverImageUrl") or "").strip()))
for x in d[:5]:
    print("-", (x.get("title") or "")[:40], bool(x.get("coverImageUrl")))
PY
