#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 JewelCAD .jcd 批量转换为伴生 OBJ 网格，供镶嵌融合与 3D 预览使用。

策略（按优先级）：
1. 从 JCD 二进制提取 float32 点云 → Open3D Poisson 表面重建（真实几何）
2. 显式 --allow-proxy 时才生成四爪镶占位网格（mesh_is_proxy=true，不用于 3D 预览）
3. 无法解析且无 proxy 许可时跳过/失败，不写假模型

伴生元数据：同目录 {basename}.mesh.json（mesh_method, mesh_is_proxy, verts, faces）
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import trimesh

try:
    import open3d as o3d
except ImportError:
    o3d = None  # type: ignore

import generate_jcd_previews as jcd_gp  # noqa: E402

DEFAULT_DB_DIR = Path(__file__).resolve().parent.parent / "镶嵌结构数据库"
ARCHIVE_DIRNAME = "_jcd_archive"
HEADER_MARKERS = jcd_gp.HEADER_MARKERS
POISSON_DEPTH = 8
MIN_POINTS = 24
SIDECAR_SUFFIX = ".mesh.json"
PROXY_VERTS = 524
PROXY_FACES = 1024
PROXY_HEADER = b"# https://github.com/mikedh/trimesh"


def parse_stone_diameter_mm(stem: str) -> float | None:
    """从文件名解析主石直径（mm）。支持 0.7、0.35X0.7、3x2mm、1.0mm。"""
    stem_clean = re.sub(r"\(\d+\)$", "", stem.strip())
    if re.search(r"[Xx]", stem_clean):
        nums: list[float] = []
        for part in re.split(r"[Xx]", stem_clean):
            m = re.search(r"(\d+\.?\d*)", part)
            if m:
                nums.append(float(m.group(1)))
        return max(nums) if nums else None
    mm_match = re.search(r"(\d+\.?\d*)\s*mm$", stem_clean, re.IGNORECASE)
    if mm_match:
        return float(mm_match.group(1))
    m = re.search(r"^(\d+\.?\d*)", stem_clean)
    return float(m.group(1)) if m else None


def sidecar_path_for_obj(obj_path: Path) -> Path:
    return obj_path.parent / f"{obj_path.stem}.mesh.json"


def read_mesh_sidecar(obj_path: Path) -> dict | None:
    sc = sidecar_path_for_obj(obj_path)
    if not sc.is_file():
        return None
    try:
        return json.loads(sc.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_mesh_sidecar(obj_path: Path, method: str, mesh_is_proxy: bool, verts: int, faces: int) -> Path:
    sc = sidecar_path_for_obj(obj_path)
    payload = {
        "mesh_method": method,
        "mesh_is_proxy": mesh_is_proxy,
        "verts": verts,
        "faces": faces,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    sc.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return sc


def count_obj_topology(obj_path: Path) -> tuple[int, int]:
    verts = faces = 0
    try:
        with obj_path.open(encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if line.startswith("v "):
                    verts += 1
                elif line.startswith("f "):
                    faces += 1
    except Exception:
        pass
    return verts, faces


def is_known_proxy_obj(obj_path: Path) -> bool:
    if not obj_path.is_file():
        return False
    sidecar = read_mesh_sidecar(obj_path)
    if sidecar is not None:
        return bool(sidecar.get("mesh_is_proxy"))
    try:
        head = obj_path.read_bytes()[:80]
        if PROXY_HEADER not in head:
            return False
        v, f = count_obj_topology(obj_path)
        return v == PROXY_VERTS and f == PROXY_FACES
    except Exception:
        return False


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
    """四爪镶占位网格（仅 --allow-proxy 时使用）。"""
    d = max(0.2, float(stone_d_mm))
    r_stone = d / 2.0
    prong_r = max(0.06, d * 0.11)
    prong_h = d * 2.2
    seat_r = r_stone * 0.92
    gallery_h = d * 0.25
    gallery_r = r_stone + prong_r * 1.6

    parts: list[trimesh.Trimesh] = []
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


def extract_points_from_jcd(data: bytes, max_points: int = 80_000) -> np.ndarray | None:
    """从 JCD 提取点云：优先 generate_jcd_previews 全量扫描，大文件再扩展窗口。"""
    pts = jcd_gp.extract_points(data, max_points=min(max_points, 8000))
    if pts is not None:
        return pts

    base = 0
    for marker in HEADER_MARKERS:
        idx = data.find(marker)
        if idx >= 0:
            base = idx + len(marker)
            break

    scan_limit = min(len(data), base + max(262144, len(data)))
    best: list[tuple[float, float, float]] = []
    for start in range(base, scan_limit - 12, 4):
        chunk_pts = jcd_gp._scan_float32_triplets(
            data, start, max_points, window=min(131072, len(data) - start)
        )
        if len(chunk_pts) > len(best):
            best = chunk_pts

    if len(best) < MIN_POINTS:
        return None
    arr = np.asarray(best, dtype=np.float64)
    return arr if jcd_gp._points_spread_ok(arr) else None


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


def remove_mesh_artifacts(obj_path: Path) -> None:
    sc = sidecar_path_for_obj(obj_path)
    if obj_path.is_file():
        obj_path.unlink()
    if sc.is_file():
        sc.unlink()


def convert_one(
    jcd_path: Path,
    force: bool,
    dry_run: bool,
    allow_proxy: bool = False,
) -> dict:
    rel = str(jcd_path)
    obj_path = jcd_path.with_suffix(".obj")
    t0 = time.perf_counter()

    if obj_path.is_file() and not force:
        sidecar = read_mesh_sidecar(obj_path)
        proxy = is_known_proxy_obj(obj_path)
        if sidecar or not proxy:
            return {
                "path": rel,
                "status": "skipped",
                "method": (sidecar or {}).get("mesh_method", "exists"),
                "mesh_is_proxy": proxy,
                "obj": str(obj_path),
                "ms": 0,
            }
        if not allow_proxy:
            return {
                "path": rel,
                "status": "skipped",
                "method": "proxy_needs_regen",
                "mesh_is_proxy": True,
                "obj": str(obj_path),
                "note": "已有 proxy OBJ，使用 --force 重建",
                "ms": 0,
            }

    if force and obj_path.is_file() and is_known_proxy_obj(obj_path):
        if not dry_run:
            remove_mesh_artifacts(obj_path)

    data = jcd_path.read_bytes()
    method = "unknown"
    mesh_is_proxy = False
    mesh: trimesh.Trimesh | None = None
    error: str | None = None

    pts = extract_points_from_jcd(data)
    if pts is not None:
        try:
            mesh = mesh_from_point_cloud(pts)
            method = "pointcloud_poisson"
            mesh_is_proxy = False
        except Exception as exc:
            error = f"Poisson 失败: {exc}"

    if mesh is None and allow_proxy:
        diameter = parse_stone_diameter_mm(jcd_path.stem) or 0.7
        mesh = build_four_prong_mesh(diameter)
        method = f"parametric_prong_d{diameter:g}mm"
        mesh_is_proxy = True

    if mesh is None or len(mesh.vertices) < 8:
        return {
            "path": rel,
            "status": "fail",
            "method": method,
            "mesh_is_proxy": False,
            "error": error or "JCD 无可用点云/网格，无法生成真实 3D",
            "ms": int((time.perf_counter() - t0) * 1000),
        }

    if dry_run:
        return {
            "path": rel,
            "status": "ok",
            "method": method,
            "mesh_is_proxy": mesh_is_proxy,
            "dry_run": True,
            "verts": len(mesh.vertices),
            "faces": len(mesh.faces),
            "point_count": int(pts.shape[0]) if pts is not None else 0,
            "ms": int((time.perf_counter() - t0) * 1000),
        }

    archive_jcd(jcd_path, dry_run=False)
    mesh.export(obj_path, file_type="obj")
    write_mesh_sidecar(obj_path, method, mesh_is_proxy, len(mesh.vertices), len(mesh.faces))

    return {
        "path": rel,
        "status": "ok",
        "method": method,
        "mesh_is_proxy": mesh_is_proxy,
        "obj": str(obj_path),
        "sidecar": str(sidecar_path_for_obj(obj_path)),
        "archive": str(jcd_path.parent / ARCHIVE_DIRNAME / jcd_path.name),
        "verts": len(mesh.vertices),
        "faces": len(mesh.faces),
        "point_count": int(pts.shape[0]) if pts is not None else 0,
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
    parser = argparse.ArgumentParser(description="JCD → 真实伴生 OBJ 网格")
    parser.add_argument("--db-dir", type=Path, default=DEFAULT_DB_DIR)
    parser.add_argument("--subdir", type=str, default=None, help="仅处理子目录，如 爪")
    parser.add_argument("--force", action="store_true", help="覆盖已有 .obj（含 proxy）")
    parser.add_argument(
        "--allow-proxy",
        action="store_true",
        help="点云失败时允许生成四爪占位网格（mesh_is_proxy=true，不用于 3D 预览）",
    )
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

    log.info("待转换 JCD: %d allow_proxy=%s", len(targets), args.allow_proxy)
    if not targets:
        return 0

    manifest_path = args.manifest or (Path(__file__).parent / "jcd_mesh_manifest.jsonl")
    if not args.dry_run:
        manifest_path.write_text("", encoding="utf-8")

    ok = fail = skip = 0
    t0 = time.perf_counter()
    for i, jcd_path in enumerate(targets, 1):
        try:
            rec = convert_one(jcd_path, force=args.force, dry_run=args.dry_run, allow_proxy=args.allow_proxy)
        except Exception as exc:
            rec = {"path": str(jcd_path), "status": "fail", "error": str(exc)}
        st = rec.get("status")
        if st == "ok":
            ok += 1
            log.info(
                "OK %s [%s] proxy=%s v=%s f=%s",
                jcd_path.name,
                rec.get("method"),
                rec.get("mesh_is_proxy"),
                rec.get("verts"),
                rec.get("faces"),
            )
        elif st == "skipped":
            skip += 1
            log.info("SKIP %s (%s)", jcd_path.name, rec.get("method"))
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
