#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""快速修复可见性不足的 JCD 预览（无需全库质量扫描）。"""

from __future__ import annotations

import argparse
import importlib.util
import sys
import time
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "generate_jcd_previews.py"
DB = Path(__file__).resolve().parent.parent / "镶嵌结构数据库"


def load_gp():
    spec = importlib.util.spec_from_file_location("gp", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def find_suspect_jcds(db_dir: Path, gp) -> list[Path]:
    suspects: list[Path] = []
    for jcd in db_dir.rglob("*.jcd"):
        png = jcd.with_suffix(".png")
        if not png.is_file():
            suspects.append(jcd)
            continue
        sz = png.stat().st_size
        if sz < 1800:
            suspects.append(jcd)
            continue
        if sz >= 5500:
            continue
        if gp.preview_quality(png) < gp.MIN_QUALITY:
            suspects.append(jcd)
    return suspects


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-dir", type=Path, default=DB)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    gp = load_gp()
    db = args.db_dir.resolve()
    targets = find_suspect_jcds(db, gp)
    if args.limit > 0:
        targets = targets[: args.limit]

    print(f"待修复: {len(targets)}", flush=True)
    ok = fail = 0
    t0 = time.perf_counter()
    for i, jcd in enumerate(targets, 1):
        png = jcd.with_suffix(".png")
        method, success = gp.generate_preview(jcd, png, gp.THUMB_SIZE, force=True)
        if success:
            ok += 1
        else:
            fail += 1
        if i % 100 == 0 or i == len(targets):
            print(f"进度 {i}/{len(targets)} ok={ok} fail={fail}", flush=True)

    print(f"完成 ok={ok} fail={fail} 耗时={time.perf_counter()-t0:.1f}s", flush=True)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
