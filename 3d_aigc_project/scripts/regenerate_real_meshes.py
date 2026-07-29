#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量重建 JCD 真实 mesh：删除 proxy OBJ，用点云 Poisson 重新转换。

用法：
  python scripts/regenerate_real_meshes.py --dry-run
  python scripts/regenerate_real_meshes.py --force --subdir "画图配件/aa/文件/P"
  python scripts/regenerate_real_meshes.py --force --delete-proxy-only
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import convert_jcd_to_mesh as mesh_conv  # noqa: E402

DEFAULT_DB_DIR = SCRIPT_DIR.parent / "镶嵌结构数据库"


def find_proxy_jcds(db_dir: Path, subdir: str | None) -> list[Path]:
    jcds = mesh_conv.collect_targets(db_dir, subdir)
    out: list[Path] = []
    for jcd in jcds:
        obj = jcd.with_suffix(".obj")
        if obj.is_file() and mesh_conv.is_known_proxy_obj(obj):
            out.append(jcd)
    return out


def find_all_with_obj(db_dir: Path, subdir: str | None) -> list[Path]:
    jcds = mesh_conv.collect_targets(db_dir, subdir)
    return [j for j in jcds if j.with_suffix(".obj").is_file()]


def main() -> int:
    parser = argparse.ArgumentParser(description="批量重建 JCD 真实 mesh（移除 proxy）")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--subdir", type=str, default=None)
    parser.add_argument("--force", action="store_true", help="执行转换（默认仅 dry-run）")
    parser.add_argument("--dry-run", action="store_true", help="只报告不写入")
    parser.add_argument("--delete-proxy-only", action="store_true", help="仅删除 proxy OBJ，不重建")
    parser.add_argument("--all-obj", action="store_true", help="重建所有已有 OBJ（不仅 proxy）")
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("regenerate_real_meshes")

    dry_run = args.dry_run or not args.force
    if args.delete_proxy_only and not dry_run:
        dry_run = False

    if args.all_obj:
        targets = find_all_with_obj(args.db_dir, args.subdir)
    else:
        targets = find_proxy_jcds(args.db_dir, args.subdir)

    log.info("目标 JCD: %d dry_run=%s delete_only=%s", len(targets), dry_run, args.delete_proxy_only)

    manifest_path = args.manifest or (SCRIPT_DIR / "regenerate_real_meshes_manifest.jsonl")
    if not dry_run:
        manifest_path.write_text("", encoding="utf-8")

    ok = fail = deleted = 0
    t0 = time.perf_counter()

    for jcd_path in targets:
        obj_path = jcd_path.with_suffix(".obj")
        rec: dict

        if args.delete_proxy_only:
            if dry_run:
                rec = {"path": str(jcd_path), "action": "would_delete_proxy", "obj": str(obj_path)}
            else:
                mesh_conv.remove_mesh_artifacts(obj_path)
                rec = {"path": str(jcd_path), "action": "deleted_proxy", "obj": str(obj_path)}
                deleted += 1
        else:
            rec = mesh_conv.convert_one(jcd_path, force=True, dry_run=dry_run, allow_proxy=False)
            rec["action"] = "regenerate"
            if rec.get("status") == "ok":
                ok += 1
            else:
                fail += 1

        if not dry_run:
            with manifest_path.open("a", encoding="utf-8") as mf:
                mf.write(json.dumps(rec, ensure_ascii=False) + "\n")

        if args.verbose or rec.get("status") == "fail":
            log.info("%s", rec)

    elapsed = time.perf_counter() - t0
    if args.delete_proxy_only:
        log.info("完成 deleted=%d 耗时=%.1fs manifest=%s", deleted, elapsed, manifest_path)
    else:
        log.info("完成 ok=%d fail=%d 耗时=%.1fs manifest=%s", ok, fail, elapsed, manifest_path)
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
