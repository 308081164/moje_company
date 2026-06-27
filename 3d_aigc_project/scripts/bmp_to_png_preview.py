#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将镶嵌结构数据库中 .jcd 同目录的 .bmp 预览图批量转为 .png。

仅处理：存在同名 .bmp、且尚无同名 .png 的 .jcd 文件。
幂等：已有 .png 则跳过。
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

from PIL import Image

DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "镶嵌结构数据库"
DEFAULT_MAX_SIZE = 256


def find_candidates(db_dir: Path) -> list[tuple[Path, Path, Path]]:
    """返回 (jcd_path, bmp_path, png_path) 列表。"""
    candidates: list[tuple[Path, Path, Path]] = []
    for jcd_path in db_dir.rglob("*.jcd"):
        bmp_path = jcd_path.with_suffix(".bmp")
        png_path = jcd_path.with_suffix(".png")
        if bmp_path.is_file() and not png_path.is_file():
            candidates.append((jcd_path, bmp_path, png_path))
    candidates.sort(key=lambda t: str(t[0]).lower())
    return candidates


def convert_bmp_to_png(
    bmp_path: Path,
    png_path: Path,
    max_size: int | None,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    with Image.open(bmp_path) as img:
        if max_size is not None:
            img = img.copy()
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        img.save(png_path, format="PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="将 .jcd 同目录 .bmp 预览图转为 .png（跳过已有 .png）"
    )
    parser.add_argument(
        "--db-dir",
        type=Path,
        default=DEFAULT_DB_DIR,
        help=f"镶嵌结构数据库根目录（默认: {DEFAULT_DB_DIR}）",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=DEFAULT_MAX_SIZE,
        help="输出 PNG 最长边像素，0 表示保持原尺寸（默认: 256）",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="最多转换条数，0 表示不限制（用于小样测试）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅统计/打印，不写入文件",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="打印每条转换记录",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("bmp_to_png_preview")

    db_dir = args.db_dir.resolve()
    if not db_dir.is_dir():
        log.error("数据库目录不存在: %s", db_dir)
        return 1

    max_size = None if args.max_size <= 0 else args.max_size
    log.info("扫描目录: %s", db_dir)
    candidates = find_candidates(db_dir)
    total = len(candidates)
    if args.limit > 0:
        candidates = candidates[: args.limit]

    log.info(
        "待转换: %d / %d（max_size=%s, dry_run=%s）",
        len(candidates),
        total,
        max_size if max_size else "original",
        args.dry_run,
    )

    converted = 0
    skipped = 0
    failed = 0
    t0 = time.perf_counter()

    for i, (jcd_path, bmp_path, png_path) in enumerate(candidates, start=1):
        rel = jcd_path.relative_to(db_dir)
        if png_path.is_file():
            skipped += 1
            continue
        try:
            convert_bmp_to_png(bmp_path, png_path, max_size, args.dry_run)
            converted += 1
            if args.verbose or args.dry_run:
                action = "would convert" if args.dry_run else "converted"
                log.info("[%d/%d] %s -> %s (%s)", i, len(candidates), bmp_path.name, png_path.name, action)
            elif i % 200 == 0 or i == len(candidates):
                elapsed = time.perf_counter() - t0
                log.info("进度 %d/%d，已转换 %d，失败 %d，耗时 %.1fs", i, len(candidates), converted, failed, elapsed)
        except Exception as exc:
            failed += 1
            log.warning("转换失败 %s: %s", rel, exc)

    elapsed = time.perf_counter() - t0
    log.info(
        "完成: 转换 %d，跳过 %d，失败 %d，总计候选 %d，耗时 %.1fs",
        converted,
        skipped,
        failed,
        total,
        elapsed,
    )
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
