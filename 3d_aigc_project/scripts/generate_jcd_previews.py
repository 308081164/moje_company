#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为 .jcd 文件批量生成可见的 PNG 预览。

策略（按优先级，每步均做质量检测）：
1. 同目录同名 .bmp → 裁剪/增强后转 PNG
2. JCD 内嵌 BMP 提取
3. 从 JCD 二进制提取点云 → 2D/3D 渲染（自动选最佳视角）
4. 高对比占位图（保证 100% 可见）

输出：与 .jcd 同目录的同名 .png
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import struct
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "镶嵌结构数据库"
PREVIEW_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
HEADER_MARKERS = (b"SILKIDEASIGN0100:", b"SILKIDEASIGN")
MIN_QUALITY = 0.035  # 非背景像素占比下限（约 3.5%）
THUMB_SIZE = 256
MIN_POINTS = 24  # 点云最少点数（与 convert_jcd_to_mesh 一致）


def has_preview_file(jcd_path: Path) -> bool:
    base = jcd_path.with_suffix("")
    parent = jcd_path.parent
    name = base.name
    for ext in PREVIEW_EXTS:
        if (parent / f"{name}{ext}").is_file():
            return True
        if (parent / f"{name}_preview{ext}").is_file():
            return True
    return False


def preview_quality(png_path: Path) -> float:
    if not png_path.is_file():
        return 0.0
    try:
        with Image.open(png_path) as im:
            im = im.convert("RGB")
            if max(im.size) > 96:
                im = im.resize((96, 96), Image.Resampling.BILINEAR)
            arr = np.array(im)
        mask = np.any(arr < 228, axis=2)
        return float(mask.sum()) / float(mask.size)
    except Exception:
        return 0.0


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("msyh.ttc", "simhei.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _valid_triplet(x: float, y: float, z: float) -> bool:
    if not (np.isfinite(x) and np.isfinite(y) and np.isfinite(z)):
        return False
    ax, ay, az = abs(x), abs(y), abs(z)
    if max(ax, ay, az) > 120 or min(ax, ay, az) < 1e-5:
        return False
    return True


def _scan_float32_triplets(
    data: bytes, start: int, max_points: int, window: int = 65536
) -> list[tuple[float, float, float]]:
    chunk = data[start : start + window]
    n = len(chunk) // 4 * 4
    if n < 36:
        return []
    arr = np.frombuffer(chunk[:n], dtype=np.float32)
    pts: list[tuple[float, float, float]] = []
    for i in range(0, len(arr) - 2, 3):
        x, y, z = float(arr[i]), float(arr[i + 1]), float(arr[i + 2])
        if not _valid_triplet(x, y, z):
            continue
        pts.append((x, y, z))
        if len(pts) >= max_points:
            break
    return pts


def _points_spread_ok(pts: np.ndarray) -> bool:
    if pts.shape[0] < 24:
        return False
    stds = np.std(pts, axis=0)
    large = sum(1 for s in stds if s > 0.08)
    return large >= 2


def extract_points(data: bytes, max_points: int = 8000) -> np.ndarray | None:
    """从 JCD 二进制提取 float32 点云（header 后 sliding window，避免全文件 O(n²) 扫描）。"""
    base = 0
    for marker in HEADER_MARKERS:
        idx = data.find(marker)
        if idx >= 0:
            base = idx + len(marker)
            break

    file_len = len(data)
    best: list[tuple[float, float, float]] = []

    # 小文件：header 后 + 文件前半段各扫一次宽窗口
    scan_starts: list[int] = [base]
    if file_len <= 524288:
        scan_starts.extend([0, max(0, file_len // 4), max(0, file_len // 2)])

    seen: set[int] = set()
    for start in scan_starts:
        if start in seen or start >= file_len - 12:
            continue
        seen.add(start)
        window = min(131072, file_len - start)
        for offset in range(start, min(file_len - 12, start + min(window, 65536)), 4):
            pts = _scan_float32_triplets(data, offset, max_points, window=min(65536, file_len - offset))
            if len(pts) > len(best):
                best = pts
            if len(best) >= max_points // 2:
                break

    if len(best) < MIN_POINTS:
        return None
    arr = np.asarray(best, dtype=np.float64)
    return arr if _points_spread_ok(arr) else None


def extract_embedded_bmp(data: bytes) -> Image.Image | None:
    search_limit = min(len(data), 131072)
    idx = 0
    while idx < search_limit:
        pos = data.find(b"BM", idx, search_limit)
        if pos < 0 or pos + 14 > len(data):
            return None
        try:
            size = struct.unpack_from("<I", data, pos + 2)[0]
            if size < 100 or pos + size > len(data):
                idx = pos + 2
                continue
            bmp_data = data[pos : pos + size]
            img = Image.open(io.BytesIO(bmp_data))
            img.load()
            return img.convert("RGB")
        except Exception:
            idx = pos + 2
            continue
    return None


def _fit_on_canvas(img: Image.Image, size: int, bg: str = "#eef2f7") -> Image.Image:
    canvas = Image.new("RGB", (size, size), bg)
    w, h = img.size
    scale = min((size - 16) / max(w, 1), (size - 16) / max(h, 1))
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    ox, oy = (size - nw) // 2, (size - nh) // 2
    canvas.paste(img, (ox, oy))
    return canvas


def enhance_image_to_png(src: Image.Image, png_path: Path, size: int = THUMB_SIZE) -> bool:
    img = src.convert("RGB")
    arr = np.array(img)
    mask = np.any(arr < 248, axis=2)
    if mask.any():
        ys, xs = np.where(mask)
        pad = 4
        x0, x1 = max(0, xs.min() - pad), min(img.width, xs.max() + pad + 1)
        y0, y1 = max(0, ys.min() - pad), min(img.height, ys.max() + pad + 1)
        if x1 - x0 > 4 and y1 - y0 > 4:
            img = img.crop((x0, y0, x1, y1))

    # 提升对比度
    arr = np.array(img, dtype=np.float32)
    lo, hi = np.percentile(arr, [2, 98])
    if hi > lo:
        arr = np.clip((arr - lo) * 255.0 / (hi - lo), 0, 255)
        img = Image.fromarray(arr.astype(np.uint8))

    out = _fit_on_canvas(img, size)
    out.save(png_path, format="PNG", optimize=True)
    return preview_quality(png_path) >= MIN_QUALITY


def bmp_to_png(bmp_path: Path, png_path: Path, size: int = THUMB_SIZE) -> bool:
    with Image.open(bmp_path) as img:
        return enhance_image_to_png(img, png_path, size)


def _normalize_points(pts: np.ndarray) -> np.ndarray:
    center = pts.mean(axis=0)
    pts = pts - center
    scale = np.max(np.linalg.norm(pts, axis=1))
    if scale <= 1e-9:
        raise ValueError("degenerate points")
    return pts / scale


def _project_area(pts: np.ndarray, elev: float, azim: float) -> float:
    elev_r, azim_r = np.radians(elev), np.radians(azim)
    # 简单旋转后投影到 XY
    c, s = np.cos(azim_r), np.sin(azim_r)
    x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
    x2 = c * x + s * y
    y2 = -s * x + c * y
    ce, se = np.cos(elev_r), np.sin(elev_r)
    y3 = ce * y2 + se * z
    span = max(x2.max() - x2.min(), y3.max() - y3.min(), 1e-6)
    return float(span * span)


def render_points_2d_png(pts: np.ndarray, png_path: Path, size: int = THUMB_SIZE) -> bool:
    pts = _normalize_points(pts)
    best_elev, best_azim, best_area = 22.0, -55.0, 0.0
    for elev in (10, 22, 35, 55):
        for azim in range(-60, 61, 20):
            area = _project_area(pts, elev, azim)
            if area > best_area:
                best_area, best_elev, best_azim = area, elev, azim

    elev_r, azim_r = np.radians(best_elev), np.radians(best_azim)
    c, s = np.cos(azim_r), np.sin(azim_r)
    x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
    px = c * x + s * y
    py = -s * x + c * y
    ce, se = np.cos(elev_r), np.sin(elev_r)
    py = ce * py + se * z

    pad = 0.18
    xmin, xmax = float(px.min()) - pad, float(px.max()) + pad
    ymin, ymax = float(py.min()) - pad, float(py.max()) + pad
    span = max(xmax - xmin, ymax - ymin, 1e-6)

    img = Image.new("RGB", (size, size), "#eef2f7")
    draw = ImageDraw.Draw(img)
    dot_r = max(2, size // 48)
    for xi, yi in zip(px, py):
        sx = int((xi - xmin) / span * (size - 12) + 6)
        sy = int((1.0 - (yi - ymin) / span) * (size - 12) + 6)
        draw.ellipse((sx - dot_r, sy - dot_r, sx + dot_r, sy + dot_r), fill="#c8960c", outline="#6b4a08")

    img.save(png_path, format="PNG", optimize=True)
    return preview_quality(png_path) >= MIN_QUALITY


def render_jcd_points_to_png(jcd_path: Path, png_path: Path, size: int = THUMB_SIZE) -> bool:
    data = jcd_path.read_bytes()
    pts = extract_points(data)
    if pts is None:
        return False
    return render_points_2d_png(pts, png_path, size)


def render_placeholder_png(jcd_path: Path, png_path: Path, size: int = THUMB_SIZE) -> bool:
    """高对比占位图，缩略图尺寸下也清晰可见。"""
    img = Image.new("RGB", (size, size), "#fff8e8")
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((4, 4, size - 5, size - 5), radius=10, outline="#c8960c", width=3, fill="#fff3d4")

    cx, cy = size // 2, size // 2 - 6
    r = size // 4
    gem = [
        (cx, cy - r),
        (cx + r, cy),
        (cx, cy + r),
        (cx - r, cy),
    ]
    draw.polygon(gem, fill="#e6b422", outline="#8a5a00", width=2)
    draw.polygon(
        [(cx, cy - r // 2), (cx + r // 2, cy), (cx, cy + r // 3), (cx - r // 2, cy)],
        fill="#ffd966",
    )

    font_sm = _load_font(13)
    font_lg = _load_font(15)
    draw.rounded_rectangle((10, 10, 52, 28), radius=5, fill="#c8960c")
    draw.text((16, 11), "JCD", fill="white", font=font_sm)

    name = jcd_path.stem
    if len(name) > 10:
        name = name[:9] + "…"
    draw.text((10, size - 34), name, fill="#5c3d00", font=font_lg)

    img.save(png_path, format="PNG", optimize=True)
    return preview_quality(png_path) >= MIN_QUALITY


def generate_preview(jcd_path: Path, png_path: Path, max_size: int, force: bool) -> tuple[str, bool]:
    if png_path.is_file() and not force:
        if preview_quality(png_path) >= MIN_QUALITY:
            return "skipped", True

    bmp_path = jcd_path.with_suffix(".bmp")
    if bmp_path.is_file():
        try:
            if bmp_to_png(bmp_path, png_path, max_size):
                return "bmp", True
        except Exception:
            pass

    data = jcd_path.read_bytes()
    if len(data) <= 524288 and b"BM" in data[:131072]:
        embedded = extract_embedded_bmp(data)
        if embedded is not None:
            try:
                if enhance_image_to_png(embedded, png_path, max_size):
                    return "embedded_bmp", True
            except Exception:
                pass

    # 小文件或无法解析几何时直接用高对比占位图，避免无意义渲染
    if jcd_path.stat().st_size < 800:
        if render_placeholder_png(jcd_path, png_path, max_size):
            return "placeholder", True
        return "none", False

    try:
        if render_jcd_points_to_png(jcd_path, png_path, max_size):
            return "render", True
    except Exception:
        pass

    if render_placeholder_png(jcd_path, png_path, max_size):
        return "placeholder", True

    return "none", False


def process_one(args_tuple: tuple[str, int, bool, bool]) -> dict:
    jcd_str, max_size, dry_run, force = args_tuple
    jcd_path = Path(jcd_str)
    png_path = jcd_path.with_suffix(".png")
    rel = str(jcd_path)
    t0 = time.perf_counter()

    if dry_run:
        return {"path": rel, "status": "ok", "method": "dry_run", "ms": 0}

    method, ok = generate_preview(jcd_path, png_path, max_size, force)
    if method == "skipped":
        return {"path": rel, "status": "skipped", "method": "exists", "quality": preview_quality(png_path), "ms": 0}
    if ok:
        return {
            "path": rel,
            "status": "ok",
            "method": method,
            "quality": round(preview_quality(png_path), 4),
            "ms": int((time.perf_counter() - t0) * 1000),
        }
    return {"path": rel, "status": "fail", "method": method, "ms": int((time.perf_counter() - t0) * 1000)}


def collect_targets(db_dir: Path, mode: str) -> list[Path]:
    all_jcd = sorted(db_dir.rglob("*.jcd"), key=lambda p: str(p).lower())
    if mode == "missing":
        return [p for p in all_jcd if not has_preview_file(p)]
    if mode == "bad":
        bad: list[Path] = []
        for p in all_jcd:
            png = p.with_suffix(".png")
            if not png.is_file():
                bad.append(p)
                continue
            sz = png.stat().st_size
            if sz < 1800:
                bad.append(p)
                continue
            if sz >= 5500:
                continue
            if preview_quality(png) < MIN_QUALITY:
                bad.append(p)
        return bad
    return all_jcd


def main() -> int:
    parser = argparse.ArgumentParser(description="批量生成 .jcd 可见预览 PNG")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--max-size", type=int, default=THUMB_SIZE)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--mode",
        choices=("missing", "bad", "all"),
        default="missing",
        help="missing=无预览; bad=低质量预览; all=全部重建",
    )
    parser.add_argument("--force", action="store_true", help="等同 --mode all")
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("generate_jcd_previews")

    db_dir = args.db_dir.resolve()
    if not db_dir.is_dir():
        log.error("目录不存在: %s", db_dir)
        return 1

    mode = "all" if args.force else args.mode
    targets = collect_targets(db_dir, mode)
    if args.limit > 0:
        targets = targets[: args.limit]

    log.info("模式=%s 待处理: %d", mode, len(targets))
    if not targets:
        return 0

    manifest_path = args.manifest or (Path(__file__).parent / "jcd_preview_manifest.jsonl")
    if not args.dry_run:
        manifest_path.write_text("", encoding="utf-8")

    force = mode in ("bad", "all")
    ok = fail = skip = 0
    methods: dict[str, int] = {}
    t0 = time.perf_counter()

    for i, jcd_path in enumerate(targets, 1):
        rec = process_one((str(jcd_path), args.max_size, args.dry_run, force))
        st = rec.get("status")
        if st == "ok":
            ok += 1
            methods[rec.get("method", "?")] = methods.get(rec.get("method", "?"), 0) + 1
        elif st == "skipped":
            skip += 1
        else:
            fail += 1
        if not args.dry_run:
            with manifest_path.open("a", encoding="utf-8") as mf:
                mf.write(json.dumps(rec, ensure_ascii=False) + "\n")
        if args.verbose or i % 100 == 0 or i == len(targets):
            log.info("进度 %d/%d ok=%d fail=%d skip=%d", i, len(targets), ok, fail, skip)

    elapsed = time.perf_counter() - t0
    log.info("完成 ok=%d fail=%d skip=%d 耗时=%.1fs 方式=%s", ok, fail, skip, elapsed, methods)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
