#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 JewelCAD .jcd（参数化/函数式建模）批量转换为伴生 OBJ 网格，供镶嵌融合管线使用。

策略：
1. 小文件（<=50KB，SILKIDEASIGN 头）：按文件名解析主石直径，程序化生成四爪镶 proxy mesh（mm）
2. 大文件：从二进制快速提取 float32 点云 → Open3D Poisson 表面重建
3. 原 .jcd 复制到同目录 _jcd_archive/ 归档（保留原位以维持前端 catalog id）

输出：与 .jcd 同目录的同名 .obj（business-service resolveInlayMeshPath 会自动选用）
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import trimesh

try:
    import open3d as o3d
except ImportError:
    o3d = None  # type: ignore

DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "镶嵌结构数据库"
ARCHIVE_DIRNAME = "_jcd_archive"
HEADER_MARKERS = (b"SILKIDEASIGN0100:", b"SILKIDEASIGN")
SMALL_JCD_MAX_BYTES = 50 * 1024
POISSON_DEPTH = 8


def parse_stone_diameter_mm(stem: str) -> float | None:
    """从文件名解析主石直径（mm）。如 0.7、0.45(1) 变体、0.35X0.7、1.0mm。"""
    stem_clean = re.sub(r"\(\d+\)$", "", stem.strip())
    mm_match = re.search(r"(\d+\.?\d*)\s*mm$", stem_clean, re.IGNORECASE)
    if mm_match:
        return float(mm_match.group(1))
    if re.search(r"[Xx]", stem_clean):
        nums: list[float] = []
        for part in re.split(r"[Xx]", stem_clean):
            m = re.search(r"\d+\.?\d*", part)
            if m:
                nums.append(float(m.group()))
        return max(nums) if nums else None
    m = re.search(r"^(\d+\.?\d*)", stem_clean)
    return float(m.group(1)) if m else None


def archive_jcd(jcd_path: Path, dry_run: bool) -> Path:
    archive_dir = jcd_path.parent / ARCHIVE_DIRNAME
    dest = archive_dir / jcd_path.name
    if dest.is_file():
        return dest
    if dry_run:
        return dest
    archive_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(jcd_path, dest)
    return dest


def build_four_prong_mesh(stone_d_mm: float, num_prongs: int = 4) -> trimesh.Trimesh:
    """
    生成近似四爪镶几何（单位 mm），用于参数化 JCD 的伴生网格。
    """
    d = max(0.2, float(stone_d_mm))
    r_stone = d / 2.0
    prong_r = max(0.06, d * 0.11)
    prong_h = d * 2.2
    seat_r = r_stone * 0.92
    gallery_h = d * 0.25
    gallery_r = r_stone + prong_r * 1.6

    parts: list[trimesh.Trimesh] = []

    # 戒托/座圈（高细分，珠宝曲面更顺滑）
    seat = trimesh.creation.cylinder(radius=seat_r, height=gallery_h, sections=64)
    seat.apply_translation([0, 0, gallery_h / 2.0])
    parts.append(seat)

    gallery = trimesh.creation.cylinder(radius=gallery_r, height=gallery_h * 0.35, sections=64)
    gallery.apply_translation([0, 0, gallery_h * 0.15])
    parts.append(gallery)

    inward_tilt = np.radians(12.0)
    for i in range(num_prongs):
        angle = 2.0 * np.pi * i / num_prongs
        cx = (r_stone + prong_r * 0.85) * np.cos(angle)
        cy = (r_stone + prong_r * 0.85) * np.sin(angle)

        prong = trimesh.creation.cylinder(radius=prong_r, height=prong_h, sections=32)
        prong.apply_translation([0, 0, prong_h / 2.0 + gallery_h * 0.5])

        rot_y = trimesh.transformations.rotation_matrix(-angle, [0, 0, 1])
        rot_x = trimesh.transformations.rotation_matrix(inward_tilt, [np.sin(angle), -np.cos(angle), 0])
        prong.apply_transform(rot_y)
        prong.apply_transform(rot_x)
        prong.apply_translation([cx, cy, 0])
        parts.append(prong)

    mesh = trimesh.util.concatenate(parts)
    mesh.merge_vertices()
    mesh.process(validate=True)
    try:
        import trimesh.smoothing as smoothing

        smoothed = smoothing.filter_laplacian(mesh, lamb=0.4, iterations=2)
        if isinstance(smoothed, trimesh.Trimesh):
            mesh = smoothed
    except Exception:
        pass
    return mesh


def _valid_triplet_row(t: np.ndarray) -> np.ndarray:
    finite = np.isfinite(t).all(axis=1)
    ax = np.abs(t)
    in_range = (ax.max(axis=1) <= 120.0) & (ax.min(axis=1) >= 1e-5)
    return finite & in_range


def extract_points_fast(data: bytes, max_points: int = 80_000) -> np.ndarray | None:
    base = 0
    for marker in HEADER_MARKERS:
        idx = data.find(marker)
        if idx >= 0:
            base = idx + len(marker)
            break

    chunk = data[base : base + 800_000]
    n = len(chunk) // 4 * 4
    if n < 36:
        return None
    arr = np.frombuffer(chunk[:n], dtype=np.float32)
    n3 = (len(arr) // 3) * 3
    triplets = arr[:n3].reshape(-1, 3)
    mask = _valid_triplet_row(triplets)
    pts = triplets[mask]
    if pts.shape[0] < 48:
        return None

    if pts.shape[0] > max_points:
        idx = np.linspace(0, pts.shape[0] - 1, max_points, dtype=np.int64)
        pts = pts[idx]

    stds = np.std(pts, axis=0)
    if sum(1 for s in stds if s > 0.08) < 2:
        return None
    return pts.astype(np.float64)


def mesh_from_point_cloud(pts: np.ndarray) -> trimesh.Trimesh:
    if o3d is None:
        raise RuntimeError("需要 open3d 进行点云重建，请安装 ai-service 依赖")

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(pts)
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=max(0.3, float(np.std(pts))), max_nn=30)
    )
    o3d_mesh, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=POISSON_DEPTH)
    o3d_mesh.remove_degenerate_triangles()
    o3d_mesh.remove_duplicated_triangles()
    o3d_mesh.remove_non_manifold_edges()

    verts = np.asarray(o3d_mesh.vertices)
    faces = np.asarray(o3d_mesh.triangles)
    if len(verts) < 24 or len(faces) < 24:
        raise ValueError("Poisson 重建网格过小")
    return trimesh.Trimesh(vertices=verts, faces=faces, process=True)


def convert_one(jcd_path: Path, force: bool, dry_run: bool) -> dict:
    rel = str(jcd_path)
    obj_path = jcd_path.with_suffix(".obj")
    t0 = time.perf_counter()

    if obj_path.is_file() and not force:
        return {"path": rel, "status": "skipped", "method": "exists", "obj": str(obj_path), "ms": 0}

    data = jcd_path.read_bytes()
    method = "unknown"
    mesh: trimesh.Trimesh | None = None

    if len(data) <= SMALL_JCD_MAX_BYTES and any(m in data[:64] for m in HEADER_MARKERS):
        diameter = parse_stone_diameter_mm(jcd_path.stem)
        if diameter is None:
            diameter = 0.7
        mesh = build_four_prong_mesh(diameter)
        method = f"parametric_prong_d{diameter:g}mm"
    else:
        pts = extract_points_fast(data)
        if pts is not None:
            mesh = mesh_from_point_cloud(pts)
            method = "pointcloud_poisson"
        else:
            diameter = parse_stone_diameter_mm(jcd_path.stem) or 0.7
            mesh = build_four_prong_mesh(diameter)
            method = f"parametric_fallback_d{diameter:g}mm"

    if mesh is None or len(mesh.vertices) < 8:
        return {"path": rel, "status": "fail", "method": method, "ms": int((time.perf_counter() - t0) * 1000)}

    if dry_run:
        return {
            "path": rel,
            "status": "ok",
            "method": method,
            "dry_run": True,
            "verts": len(mesh.vertices),
            "faces": len(mesh.faces),
            "ms": int((time.perf_counter() - t0) * 1000),
        }

    archive_jcd(jcd_path, dry_run=False)
    mesh.export(obj_path, file_type="obj")
    return {
        "path": rel,
        "status": "ok",
        "method": method,
        "obj": str(obj_path),
        "archive": str(jcd_path.parent / ARCHIVE_DIRNAME / jcd_path.name),
        "verts": len(mesh.vertices),
        "faces": len(mesh.faces),
        "ms": int((time.perf_counter() - t0) * 1000),
    }


def collect_targets(db_dir: Path, subdir: str | None) -> list[Path]:
    root = db_dir.resolve()
    if subdir:
        root = root / subdir
    if not root.is_dir():
        raise FileNotFoundError(f"目录不存在: {root}")

    targets: list[Path] = []
    for jcd_path in sorted(root.rglob("*.jcd"), key=lambda p: str(p).lower()):
        rel = jcd_path.as_posix()
        if "/_jcd_archive/" in rel or jcd_path.parent.name == "_jcd_archive":
            continue
        targets.append(jcd_path)
    return targets


def main() -> int:
    parser = argparse.ArgumentParser(description="JCD → 伴生 OBJ 网格（镶嵌融合用）")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--subdir", type=str, default=None, help="仅处理子目录，如 爪")
    parser.add_argument("--force", action="store_true", help="覆盖已有 .obj")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    log = logging.getLogger("convert_jcd_to_mesh")

    try:
        targets = collect_targets(args.db_dir, args.subdir)
    except FileNotFoundError as e:
        log.error("%s", e)
        return 1

    log.info("待转换 JCD: %d", len(targets))
    if not targets:
        return 0

    manifest_path = args.manifest or (Path(__file__).parent / "jcd_mesh_manifest.jsonl")
    if not args.dry_run:
        manifest_path.write_text("", encoding="utf-8")

    ok = fail = skip = 0
    t0 = time.perf_counter()
    for i, jcd_path in enumerate(targets, 1):
        try:
            rec = convert_one(jcd_path, force=args.force, dry_run=args.dry_run)
        except Exception as exc:
            rec = {"path": str(jcd_path), "status": "fail", "error": str(exc)}
        st = rec.get("status")
        if st == "ok":
            ok += 1
            log.info("OK %s [%s] v=%s f=%s", jcd_path.name, rec.get("method"), rec.get("verts"), rec.get("faces"))
        elif st == "skipped":
            skip += 1
            log.info("SKIP %s", jcd_path.name)
        else:
            fail += 1
            log.error("FAIL %s %s", jcd_path.name, rec.get("error", rec.get("method")))

        if not args.dry_run:
            with manifest_path.open("a", encoding="utf-8") as mf:
                mf.write(json.dumps(rec, ensure_ascii=False) + "\n")

        if args.verbose and i % 10 == 0:
            log.info("进度 %d/%d", i, len(targets))

    elapsed = time.perf_counter() - t0
    log.info("完成 ok=%d fail=%d skip=%d 耗时=%.1fs manifest=%s", ok, fail, skip, elapsed, manifest_path)
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
