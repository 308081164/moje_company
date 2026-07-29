#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 legacy 文件夹资产复制到 v2 对象存储，实现与「镶嵌结构数据库/」完全解耦。

用法（删除文件夹前必须执行）：
  python scripts/rehydrate_inlay_storage.py --api http://localhost:8854
  python scripts/rehydrate_inlay_storage.py --api http://localhost:8854 --force
  python scripts/rehydrate_inlay_storage.py --api http://localhost:8854 --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request


def post(api_base: str, path: str, params: dict | None = None) -> dict:
    qs = ""
    if params:
        qs = "?" + urllib.parse.urlencode(params)
    url = f"{api_base.rstrip('/')}{path}{qs}"
    req = urllib.request.Request(url, method="POST")
    with urllib.request.urlopen(req, timeout=7200) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body.get("data", body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Rehydrate inlay assets into object storage")
    parser.add_argument("--api", default="http://localhost:8854")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"POST {args.api}/api/inlay/v2/import/rehydrate-storage ...")
    result = post(
        args.api,
        "/api/inlay/v2/import/rehydrate-storage",
        {"force": str(args.force).lower(), "dry_run": str(args.dry_run).lower()},
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if not args.dry_run:
        print("\n同步 mesh 元数据...")
        sync = post(args.api, "/api/inlay/v2/import/sync-mesh-metadata")
        print(json.dumps(sync, ensure_ascii=False, indent=2))

    ok = result.get("ok", 0)
    partial = result.get("partial", 0)
    fail = result.get("fail", 0)
    if args.dry_run:
        return 0
    if ok + partial == 0 and fail > 0:
        print("ERROR: 无成功条目，请勿删除 legacy 文件夹", file=sys.stderr)
        return 1
    if result.get("legacy_folder_available") is False:
        print("WARN: legacy 文件夹不可用，仅修复已有 storage 中的 legacy: 指针")
    print("\n完成。确认 ok/partial 后可将 inlay-v2.legacy-fallback 保持 false 并删除「镶嵌结构数据库/」。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
