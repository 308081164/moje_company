#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
镶嵌结构数据库全量处理编排器：JCD → 伴生 OBJ + 真实 PNG 预览。

阶段（默认全部执行）：
  scan   扫描并输出 manifest（可选 --scan-only）
  mesh   JCD → 同目录 .obj（复用 convert_jcd_to_mesh）
  preview  真实预览 .png（BMP 优先，与 指甲爪-1 一致；必要时 mesh 渲染）

示例：
  python scripts/convert_all_inlays.py --scan-only
  python scripts/convert_all_inlays.py --preview-only --skip-good-preview
  python scripts/convert_all_inlays.py --subdir 爪
  python scripts/convert_all_inlays.py --limit 100 -v
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import convert_jcd_to_mesh as mesh_conv  # noqa: E402
import generate_jcd_previews as jcd_gp  # noqa: E402
import generate_mesh_previews as mesh_prev  # noqa: E402

DEFAULT_DB_DIR = SCRIPT_DIR.parent / "镶嵌结构数据库"
PLACEHOLDER_QUALITY = mesh_prev.PLACEHOLDER_QUALITY
MIN_PREVIEW_QUALITY = 0.012


@dataclass
class InlayEntry:
    jcd: str
    rel: str
    size_bytes: int
    has_bmp: bool
    has_obj: bool
    obj_is_proxy: bool
    has_png: bool
    png_quality: float
    png_is_placeholder: bool
    need_mesh: bool
    need_preview: bool


def is_archive_path(path: Path) -> bool:
    rel = path.as_posix()
    return "/_jcd_archive/" in rel or path.parent.name == "_jcd_archive"


def collect_jcds(db_dir: Path, subdir: str | None) -> list[Path]:
    root = db_dir.resolve()
    if subdir:
        root = root / subdir.replace("\\", "/")
    if not root.is_dir():
        raise FileNotFoundError(f"目录不存在: {root}")

    out: list[Path] = []
    for jcd_path in sorted(root.rglob("*.jcd"), key=lambda p: str(p).lower()):
        if is_archive_path(jcd_path):
            continue
        out.append(jcd_path)
    return out


def scan_entry(jcd_path: Path, db_dir: Path, skip_good_preview: bool) -> InlayEntry:
    rel = jcd_path.relative_to(db_dir).as_posix()
    png_path = jcd_path.with_suffix(".png")
    obj_path = jcd_path.with_suffix(".obj")
    has_png = png_path.is_file()
    quality = jcd_gp.preview_quality(png_path) if has_png else 0.0
    placeholder = mesh_prev.is_jcd_placeholder_png(png_path) if has_png else True
    has_obj = obj_path.is_file()
    obj_is_proxy = mesh_conv.is_known_proxy_obj(obj_path) if has_obj else False
    need_mesh = not has_obj or obj_is_proxy
    need_preview = True
    if skip_good_preview and has_png and not placeholder and quality >= jcd_gp.MIN_QUALITY:
        need_preview = False
    return InlayEntry(
        jcd=str(jcd_path),
        rel=rel,
        size_bytes=jcd_path.stat().st_size,
        has_bmp=jcd_path.with_suffix(".bmp").is_file(),
        has_obj=has_obj,
        obj_is_proxy=obj_is_proxy,
        has_png=has_png,
        png_quality=round(quality, 4),
        png_is_placeholder=placeholder,
        need_mesh=need_mesh,
        need_preview=need_preview,
    )


def refresh_preview_for_jcd(jcd_path: Path, force: bool = False) -> tuple[str, bool, float]:
    """为 JCD 刷新 PNG（BMP / 内嵌 BMP / 点云，不依赖 OBJ）。"""
    png_path = jcd_path.with_suffix(".png")
    if not force and png_path.is_file() and not mesh_prev.is_jcd_placeholder_png(png_path):
        q = jcd_gp.preview_quality(png_path)
        if q >= jcd_gp.MIN_QUALITY:
            return "skipped", True, q

    bmp_path = jcd_path.with_suffix(".bmp")
    if bmp_path.is_file():
        if jcd_gp.bmp_to_png(bmp_path, png_path, jcd_gp.THUMB_SIZE):
            q = jcd_gp.preview_quality(png_path)
            if q >= MIN_PREVIEW_QUALITY:
                return "bmp", True, q

    data = jcd_path.read_bytes()
    if len(data) <= 524288 and b"BM" in data[:131072]:
        embedded = jcd_gp.extract_embedded_bmp(data)
        if embedded is not None and jcd_gp.enhance_image_to_png(embedded, png_path, jcd_gp.THUMB_SIZE):
            q = jcd_gp.preview_quality(png_path)
            if q >= MIN_PREVIEW_QUALITY:
                return "embedded_bmp", True, q

    try:
        pts = jcd_gp.extract_points(data)
        if pts is not None and jcd_gp.render_points_2d_png(pts, png_path, jcd_gp.THUMB_SIZE):
            q = jcd_gp.preview_quality(png_path)
            if q >= MIN_PREVIEW_QUALITY:
                return "jcd_pointcloud", True, q
    except Exception:
        pass

    return "none", False, jcd_gp.preview_quality(png_path) if png_path.is_file() else 0.0


def refresh_preview_full(jcd_path: Path, force: bool = False) -> dict:
    """完整预览刷新：JCD 源优先，仍占位则尝试伴生 OBJ mesh 渲染。"""
    t0 = time.perf_counter()
    png_path = jcd_path.with_suffix(".png")
    method, ok, quality = refresh_preview_for_jcd(jcd_path, force=force)

    if (not ok or mesh_prev.is_jcd_placeholder_png(png_path)) and jcd_path.with_suffix(".obj").is_file():
        obj_path = jcd_path.with_suffix(".obj")
        if mesh_conv.is_known_proxy_obj(obj_path):
            pass  # 不用 proxy mesh 渲染 2D
        else:
            try:
                method = mesh_prev.generate_preview_for_mesh(obj_path, png_path)
                quality = jcd_gp.preview_quality(png_path)
                ok = quality >= MIN_PREVIEW_QUALITY and png_path.stat().st_size >= 1200
            except Exception as exc:
                return {
                    "path": str(jcd_path),
                    "phase": "preview",
                    "status": "fail",
                    "method": method,
                    "error": str(exc),
                    "ms": int((time.perf_counter() - t0) * 1000),
                }
            if ok:
                return {
                    "path": str(jcd_path),
                    "phase": "preview",
                    "status": "ok",
                    "method": method,
                    "quality": round(quality, 4),
                    "bytes": png_path.stat().st_size if png_path.is_file() else 0,
                    "ms": int((time.perf_counter() - t0) * 1000),
                }

    if ok:
        return {
            "path": str(jcd_path),
            "phase": "preview",
            "status": "ok",
            "method": method,
            "quality": round(quality, 4),
            "bytes": png_path.stat().st_size if png_path.is_file() else 0,
            "ms": int((time.perf_counter() - t0) * 1000),
        }

    return {
        "path": str(jcd_path),
        "phase": "preview",
        "status": "fail",
        "method": method,
        "quality": round(quality, 4),
        "error": "无法生成合格预览",
        "ms": int((time.perf_counter() - t0) * 1000),
    }


def process_one_jcd(
    jcd_path: Path,
    *,
    do_mesh: bool,
    do_preview: bool,
    mesh_force: bool,
    preview_force: bool,
    dry_run: bool,
) -> list[dict]:
    records: list[dict] = []

    if do_mesh:
        t0 = time.perf_counter()
        try:
            rec = mesh_conv.convert_one(jcd_path, force=mesh_force, dry_run=dry_run, allow_proxy=False)
            rec["phase"] = "mesh"
            records.append(rec)
        except Exception as exc:
            records.append(
                {
                    "path": str(jcd_path),
                    "phase": "mesh",
                    "status": "fail",
                    "error": str(exc),
                    "ms": int((time.perf_counter() - t0) * 1000),
                }
            )

    if do_preview and not dry_run:
        records.append(refresh_preview_full(jcd_path, force=preview_force))
    elif do_preview and dry_run:
        records.append(
            {
                "path": str(jcd_path),
                "phase": "preview",
                "status": "ok",
                "method": "dry_run",
            }
        )

    return records


def write_manifest_line(manifest_path: Path, rec: dict) -> None:
    with manifest_path.open("a", encoding="utf-8") as mf:
        mf.write(json.dumps(rec, ensure_ascii=False) + "\n")


def run_scan(entries: list[InlayEntry], manifest_path: Path) -> None:
    manifest_path.write_text("", encoding="utf-8")
    for e in entries:
        write_manifest_line(manifest_path, {"phase": "scan", **asdict(e)})


def _accumulate(rec: dict, counters: dict) -> None:
    phase = rec.get("phase")
    st = rec.get("status")
    if phase == "mesh":
        if st == "ok":
            counters["mesh_ok"] += 1
        elif st == "skipped":
            counters["mesh_skip"] += 1
        else:
            counters["mesh_fail"] += 1
    elif phase == "preview":
        if st == "ok":
            if rec.get("method") == "skipped":
                counters["prev_skip"] += 1
            else:
                counters["prev_ok"] += 1
        else:
            counters["prev_fail"] += 1


def _tally(rec: dict, log: logging.Logger) -> None:
    phase = rec.get("phase")
    st = rec.get("status")
    name = Path(rec.get("path", "")).name
    if phase == "mesh":
        if st == "ok":
            log.info("MESH OK %s [%s]", name, rec.get("method"))
        elif st == "skipped":
            log.debug("MESH SKIP %s", name)
        else:
            log.error("MESH FAIL %s %s", name, rec.get("error", rec.get("method")))
    elif phase == "preview":
        if st == "ok":
            log.info("PREV OK %s [%s] q=%s", name, rec.get("method"), rec.get("quality"))
        else:
            log.error("PREV FAIL %s %s", name, rec.get("error"))


def main() -> int:
    parser = argparse.ArgumentParser(description="镶嵌库全量：JCD→OBJ + 真实预览")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--subdir", type=str, default=None, help="仅处理子目录，如 爪 或 广州资料库/四爪镶口")
    parser.add_argument("--scan-only", action="store_true", help="仅扫描输出 manifest")
    parser.add_argument("--preview-only", action="store_true", help="仅刷新预览，不转 OBJ")
    parser.add_argument("--mesh-only", action="store_true", help="仅转 OBJ，不刷新预览")
    parser.add_argument(
        "--skip-good-preview",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="跳过已有真实预览（默认开启）",
    )
    parser.add_argument("--force-mesh", action="store_true", help="覆盖已有 OBJ")
    parser.add_argument("--force-preview", action="store_true", help="覆盖已有 PNG")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=1, help="并行线程（预览 I/O；mesh 大文件建议 1-2）")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("convert_all_inlays")

    if args.preview_only and args.mesh_only:
        log.error("--preview-only 与 --mesh-only 不能同时使用")
        return 1

    do_mesh = not args.preview_only
    do_preview = not args.mesh_only

    try:
        jcds = collect_jcds(args.db_dir, args.subdir)
    except FileNotFoundError as e:
        log.error("%s", e)
        return 1

    if args.limit > 0:
        jcds = jcds[: args.limit]

    log.info("扫描 %d 个 JCD ...", len(jcds))
    entries = [scan_entry(p, args.db_dir.resolve(), args.skip_good_preview) for p in jcds]

    stats = {
        "total": len(entries),
        "has_bmp": sum(1 for e in entries if e.has_bmp),
        "has_obj": sum(1 for e in entries if e.has_obj),
        "placeholder_png": sum(1 for e in entries if e.png_is_placeholder),
        "need_mesh": sum(1 for e in entries if e.need_mesh),
        "need_preview": sum(1 for e in entries if e.need_preview),
    }
    log.info("扫描结果: %s", stats)

    manifest_path = args.manifest or (SCRIPT_DIR / "convert_all_inlays_manifest.jsonl")
    run_scan(entries, manifest_path)

    if args.scan_only:
        log.info("scan-only 完成 manifest=%s", manifest_path)
        return 0

    targets = [Path(e.jcd) for e in entries if e.need_mesh or e.need_preview or args.force_mesh or args.force_preview]
    if args.skip_good_preview and not args.force_preview:
        targets = [
            Path(e.jcd)
            for e in entries
            if (do_mesh and (e.need_mesh or args.force_mesh))
            or (do_preview and (e.need_preview or args.force_preview))
        ]

    log.info(
        "开始处理 %d 项 mesh=%s preview=%s workers=%d dry_run=%s",
        len(targets),
        do_mesh,
        do_preview,
        args.workers,
        args.dry_run,
    )

    mesh_ok = mesh_fail = mesh_skip = 0
    prev_ok = prev_fail = prev_skip = 0
    counters = {
        "mesh_ok": 0,
        "mesh_fail": 0,
        "mesh_skip": 0,
        "prev_ok": 0,
        "prev_fail": 0,
        "prev_skip": 0,
    }
    t0 = time.perf_counter()

    def work(jcd_path: Path) -> list[dict]:
        entry = next((e for e in entries if e.jcd == str(jcd_path)), None)
        run_m = do_mesh and (args.force_mesh or (entry.need_mesh if entry else True))
        run_p = do_preview and (
            args.force_preview or (entry.need_preview if entry else True)
        )
        if not run_m and not run_p:
            return []
        return process_one_jcd(
            jcd_path,
            do_mesh=run_m,
            do_preview=run_p,
            mesh_force=args.force_mesh,
            preview_force=args.force_preview,
            dry_run=args.dry_run,
        )

    if args.workers <= 1:
        for i, jcd_path in enumerate(targets, 1):
            for rec in work(jcd_path):
                if not args.dry_run:
                    write_manifest_line(manifest_path, rec)
                _accumulate(rec, counters)
                _tally(rec, log)
            if i % 50 == 0 or i == len(targets):
                log.info("进度 %d/%d", i, len(targets))
    else:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(work, p): p for p in targets}
            for i, fut in enumerate(as_completed(futures), 1):
                jcd_path = futures[fut]
                try:
                    recs = fut.result()
                except Exception as exc:
                    recs = [{"path": str(jcd_path), "phase": "fail", "status": "fail", "error": str(exc)}]
                for rec in recs:
                    if not args.dry_run:
                        write_manifest_line(manifest_path, rec)
                    _accumulate(rec, counters)
                if i % 100 == 0 or i == len(targets):
                    log.info("进度 %d/%d", i, len(targets))

    mesh_ok = counters["mesh_ok"]
    mesh_fail = counters["mesh_fail"]
    mesh_skip = counters["mesh_skip"]
    prev_ok = counters["prev_ok"]
    prev_fail = counters["prev_fail"]
    prev_skip = counters["prev_skip"]

    elapsed = time.perf_counter() - t0
    summary = {
        "phase": "summary",
        "mesh_ok": mesh_ok,
        "mesh_fail": mesh_fail,
        "mesh_skip": mesh_skip,
        "preview_ok": prev_ok,
        "preview_fail": prev_fail,
        "preview_skip": prev_skip,
        "elapsed_s": round(elapsed, 1),
        "manifest": str(manifest_path),
    }
    if not args.dry_run:
        write_manifest_line(manifest_path, summary)
    log.info(
        "完成 mesh ok=%d fail=%d skip=%d | preview ok=%d fail=%d skip=%d | %.1fs | %s",
        mesh_ok,
        mesh_fail,
        mesh_skip,
        prev_ok,
        prev_fail,
        prev_skip,
        elapsed,
        manifest_path,
    )
    return 0 if mesh_fail == 0 and prev_fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
