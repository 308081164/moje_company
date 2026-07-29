#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 legacy 镶嵌结构数据库导入到 v2 元数据层。

用法：
  python scripts/migrate_inlay_to_db.py --phase scan --manifest migration_scan.jsonl
  python scripts/migrate_inlay_to_db.py --phase upload --api http://localhost:8854
  python scripts/migrate_inlay_to_db.py --phase verify --api http://localhost:8854
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import convert_all_inlays as orchestrator  # noqa: E402

DEFAULT_DB = SCRIPT_DIR.parent / "镶嵌结构数据库"
DEFAULT_API = "http://localhost:8854"


def phase_scan(db_dir: Path, manifest: Path, subdir: str | None) -> int:
    jcds = orchestrator.collect_jcds(db_dir, subdir)
    entries = []
    for jcd in jcds:
        entry = orchestrator.scan_entry(jcd, db_dir, skip_good_preview=True)
        entries.append(asdict_entry(entry))

    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    print(f"scan: {len(entries)} JCD entries -> {manifest}")
    return len(entries)


def asdict_entry(entry) -> dict:
    from dataclasses import asdict
    return asdict(entry)


def phase_upload(api_base: str, dry_run: bool) -> dict:
    url = f"{api_base.rstrip('/')}/api/inlay/v2/import/scan-legacy?dry_run={'true' if dry_run else 'false'}"
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=3600) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    print(json.dumps(body, ensure_ascii=False, indent=2))
    return body.get("data", body)


def phase_verify(api_base: str, sample: int = 20) -> bool:
    url = f"{api_base.rstrip('/')}/api/inlay/v2/stats"
    with urllib.request.urlopen(url, timeout=30) as resp:
        stats = json.loads(resp.read().decode("utf-8"))
    total = stats.get("data", {}).get("total", 0)
    print(f"verify: v2 catalog total={total}")
    return total > 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy inlay DB to v2")
    parser.add_argument("--phase", choices=["scan", "upload", "verify"], default="upload")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB)
    parser.add_argument("--manifest", type=Path, default=SCRIPT_DIR / "migration_scan.jsonl")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--subdir", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.phase == "scan":
        phase_scan(args.db_dir, args.manifest, args.subdir)
    elif args.phase == "upload":
        phase_upload(args.api, args.dry_run)
    elif args.phase == "verify":
        ok = phase_verify(args.api)
        return 0 if ok else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
