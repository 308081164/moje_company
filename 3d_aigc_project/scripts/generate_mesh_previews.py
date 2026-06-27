#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为 OBJ/GLB/STL 镶嵌结构生成真实 PNG 预览（与 generate_jcd_previews 策略对齐）。

优先级（与 指甲爪-1 等合格预览一致）：
1. 同目录同名 .bmp → enhance_image_to_png（JewelCAD 官方渲染，最佳）
2. 同目录同名 .jcd 内嵌 BMP
3. 同目录同名 .jcd 点云投影渲染
4. mesh 平滑着色离屏渲染（无三角线框，珠宝金材质感）

输出：与 mesh 同目录同名 .png
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image

# 复用 JCD 预览管线（bmp / 点云 / 质量检测）
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import generate_jcd_previews as jcd_gp  # noqa: E402

DEFAULT_DB_DIR = SCRIPT_DIR.parent / "镶嵌结构数据库"
MESH_EXTENSIONS = {".obj", ".glb", ".stl"}
THUMB_SIZE = jcd_gp.THUMB_SIZE
VIEW_ELEV = 25.0
VIEW_AZIM = -60.0
PLACEHOLDER_QUALITY = 0.90  # JCD 占位图通常 >0.9


def load_trimesh(mesh_path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(mesh_path, force="mesh")
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise ValueError("场景中无可用三角网格")
        loaded = trimesh.util.concatenate(meshes)
    if not isinstance(loaded, trimesh.Trimesh) or len(loaded.vertices) < 4:
        raise ValueError("网格为空或无效")
    loaded.merge_vertices()
    loaded.process(validate=True)
    return loaded


def smooth_jewelry_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """轻度平滑，消除参数化网格的棱角感（不改变整体形态）。"""
    try:
        import trimesh.smoothing as smoothing

        if len(mesh.faces) <= 8000:
            smoothed = smoothing.filter_laplacian(mesh, lamb=0.45, iterations=2)
            if isinstance(smoothed, trimesh.Trimesh):
                return smoothed
    except Exception:
        pass
    return mesh


def render_smooth_mesh_png(mesh_path: Path, png_path: Path, size: int = THUMB_SIZE) -> None:
    """平滑着色渲染（无 wireframe），适合珠宝曲面。"""
    mesh = smooth_jewelry_mesh(load_trimesh(mesh_path))
    if len(mesh.faces) < 1200 and len(mesh.faces) <= 3000:
        try:
            mesh = mesh.subdivide_loop(iterations=1)
        except Exception:
            pass

    verts = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    verts = verts - verts.mean(axis=0)
    span = float(np.ptp(verts, axis=0).max())
    if span > 1e-9:
        verts = verts / span

    polys = verts[faces]
    # 面法线 + 简单 Phong 光照（无三角线框）
    v0, v1, v2 = polys[:, 0], polys[:, 1], polys[:, 2]
    normals = np.cross(v1 - v0, v2 - v0)
    norm_len = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / np.maximum(norm_len, 1e-9)
    az, alt = np.radians(VIEW_AZIM), np.radians(VIEW_ELEV)
    light = np.array([
        np.cos(alt) * np.sin(az),
        np.cos(alt) * np.cos(az),
        np.sin(alt),
    ])
    intensity = np.clip(normals @ light, 0.0, 1.0)
    gold = np.array([0.78, 0.62, 0.22])
    face_rgb = np.clip(gold * (0.32 + 0.68 * intensity[:, np.newaxis]), 0, 1)

    fig = plt.figure(figsize=(size / 100, size / 100), dpi=100, facecolor="#eef2f7")
    ax = fig.add_subplot(111, projection="3d", facecolor="#eef2f7")
    collection = Poly3DCollection(
        polys,
        linewidths=0.0,
        edgecolors="none",
        facecolors=face_rgb,
        antialiased=True,
    )
    ax.add_collection3d(collection)

    pad = 0.12
    mn, mx = verts.min(axis=0), verts.max(axis=0)
    ax.set_xlim(mn[0] - pad, mx[0] + pad)
    ax.set_ylim(mn[1] - pad, mx[1] + pad)
    ax.set_zlim(mn[2] - pad, mx[2] + pad)
    ax.view_init(elev=VIEW_ELEV, azim=VIEW_AZIM)
    ax.set_axis_off()
    ax.set_box_aspect([1, 1, 1])
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(png_path, dpi=100, facecolor="#eef2f7", bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)


def is_jcd_placeholder_png(png_path: Path) -> bool:
    if not png_path.is_file():
        return True
    q = jcd_gp.preview_quality(png_path)
    if q >= PLACEHOLDER_QUALITY:
        return True
    if png_path.stat().st_size < 3500:
        return True
    return False


def generate_preview_for_mesh(mesh_path: Path, png_path: Path, size: int = THUMB_SIZE) -> str:
    """返回使用的方法名。"""
    stem = mesh_path.with_suffix("")
    bmp_path = stem.with_suffix(".bmp")
    jcd_path = stem.with_suffix(".jcd")

    if bmp_path.is_file():
        if jcd_gp.bmp_to_png(bmp_path, png_path, size):
            return "bmp"

    if jcd_path.is_file():
        data = jcd_path.read_bytes()
        if len(data) <= 524288 and b"BM" in data[:131072]:
            embedded = jcd_gp.extract_embedded_bmp(data)
            if embedded is not None and jcd_gp.enhance_image_to_png(embedded, png_path, size):
                return "embedded_bmp"
        try:
            if jcd_gp.render_jcd_points_to_png(jcd_path, png_path, size):
                return "jcd_pointcloud"
        except Exception:
            pass

    render_smooth_mesh_png(mesh_path, png_path, size)
    return "mesh_smooth_shaded"


def collect_targets(db_dir: Path, subdir: str | None, force: bool) -> list[Path]:
    root = db_dir.resolve()
    if subdir:
        root = root / subdir
    if not root.is_dir():
        raise FileNotFoundError(f"目录不存在: {root}")

    targets: list[Path] = []
    for ext in MESH_EXTENSIONS:
        for mesh_path in sorted(root.rglob(f"*{ext}")):
            rel = mesh_path.as_posix()
            if "/_jcd_archive/" in rel or mesh_path.parent.name == "_jcd_archive":
                continue
            png_path = mesh_path.with_suffix(".png")
            if force or not png_path.is_file() or is_jcd_placeholder_png(png_path):
                targets.append(mesh_path)
    return targets


def process_one(mesh_path: Path, dry_run: bool) -> dict:
    png_path = mesh_path.with_suffix(".png")
    t0 = time.perf_counter()
    if dry_run:
        return {"path": str(mesh_path), "status": "ok", "method": "dry_run", "png": str(png_path)}

    try:
        method = generate_preview_for_mesh(mesh_path, png_path)
        quality = jcd_gp.preview_quality(png_path)
        if quality < 0.02 or png_path.stat().st_size < 1500:
            raise ValueError(f"预览质量过低 quality={quality:.4f}")
        return {
            "path": str(mesh_path),
            "status": "ok",
            "method": method,
            "png": str(png_path),
            "quality": round(quality, 4),
            "bytes": png_path.stat().st_size,
            "ms": int((time.perf_counter() - t0) * 1000),
        }
    except Exception as exc:
        return {
            "path": str(mesh_path),
            "status": "fail",
            "error": str(exc),
            "ms": int((time.perf_counter() - t0) * 1000),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="镶嵌 mesh 真实预览图（BMP 优先，与 JCD 预览一致）")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--subdir", type=str, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("generate_mesh_previews")

    try:
        targets = collect_targets(args.db_dir, args.subdir, args.force)
    except FileNotFoundError as e:
        log.error("%s", e)
        return 1

    log.info("待生成 mesh 预览: %d", len(targets))
    if not targets:
        return 0

    manifest_path = args.manifest or (SCRIPT_DIR / "mesh_preview_manifest.jsonl")
    if not args.dry_run:
        manifest_path.write_text("", encoding="utf-8")

    ok = fail = 0
    t0 = time.perf_counter()
    for i, mesh_path in enumerate(targets, 1):
        rec = process_one(mesh_path, args.dry_run)
        if rec.get("status") == "ok":
            ok += 1
            log.info("OK %s [%s] q=%s", mesh_path.name, rec.get("method"), rec.get("quality"))
        else:
            fail += 1
            log.error("FAIL %s %s", mesh_path.name, rec.get("error"))
        if not args.dry_run:
            with manifest_path.open("a", encoding="utf-8") as mf:
                mf.write(json.dumps(rec, ensure_ascii=False) + "\n")

    log.info("完成 ok=%d fail=%d 耗时=%.1fs", ok, fail, time.perf_counter() - t0)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
