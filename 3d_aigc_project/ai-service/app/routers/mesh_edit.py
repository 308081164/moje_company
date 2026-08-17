"""
网格编辑 API：分量拆分、清洗、合并、剖切（镶嵌库裁剪 MVP）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import trimesh
from fastapi import APIRouter, Form, HTTPException

from app.config import get_config
from app.services.mesh_processor import get_mesh_processor
from app.utils.file_utils import ensure_dir

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mesh/edit", tags=["网格编辑"])

SUPPORTED_FORMATS = {"obj", "glb", "stl"}


def _normalize_format(value: str) -> str:
    fmt = (value or "").strip().lower().lstrip(".")
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的格式: {value}，支持: {', '.join(sorted(SUPPORTED_FORMATS))}",
        )
    return fmt


def _component_meta(index: int, comp: trimesh.Trimesh) -> Dict[str, Any]:
    bounds = comp.bounds
    ext = bounds[1] - bounds[0]
    return {
        "index": index,
        "face_count": int(len(comp.faces)),
        "vertex_count": int(len(comp.vertices)),
        "bbox_min": bounds[0].tolist(),
        "bbox_max": bounds[1].tolist(),
        "extent": ext.tolist(),
        "volume_bbox": float(np.prod(np.maximum(ext, 1e-9))),
    }


def _merge_by_indices(comps: List[trimesh.Trimesh], keep_indices: List[int]) -> trimesh.Trimesh:
    if not keep_indices:
        raise ValueError("keep_indices 不能为空")
    selected = []
    for idx in keep_indices:
        if idx < 0 or idx >= len(comps):
            raise ValueError(f"无效分量 index: {idx}")
        selected.append(comps[idx])
    if len(selected) == 1:
        return selected[0]
    return trimesh.util.concatenate(selected)


def _clip_mesh_halfspace(
    mesh: trimesh.Trimesh,
    plane_origin: List[float],
    plane_normal: List[float],
    keep_positive: bool = True,
) -> trimesh.Trimesh:
    origin = np.asarray(plane_origin, dtype=np.float64)
    normal = np.asarray(plane_normal, dtype=np.float64)
    n_norm = np.linalg.norm(normal)
    if n_norm < 1e-12:
        raise ValueError("plane_normal 不能为零向量")
    normal = normal / n_norm

    verts = np.asarray(mesh.vertices, dtype=np.float64)
    rel = verts - origin
    signed = rel @ normal
    if keep_positive:
        vert_keep = signed >= -1e-6
    else:
        vert_keep = signed <= 1e-6

    face_mask = vert_keep[mesh.faces].all(axis=1)
    if not np.any(face_mask):
        raise ValueError("剖切后无剩余面片，请调整平面位置")

    sub = mesh.submesh([np.where(face_mask)[0]], append=True, repair=False)
    if isinstance(sub, list):
        sub = trimesh.util.concatenate(sub) if len(sub) > 1 else sub[0]
    return sub


@router.post("/sanitize", summary="网格清洗（去 junk + 主装配）")
async def sanitize_mesh(
    mesh_path: str = Form(..., description="输入网格路径"),
    output_path: Optional[str] = Form(None, description="可选输出路径"),
    select_primary: bool = Form(True, description="是否只保留主装配"),
):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")

    processor = get_mesh_processor()
    config = get_config()
    sid = uuid.uuid4().hex[:16]
    if not output_path:
        ext = Path(mesh_path).suffix.lower() or ".glb"
        out_dir = os.path.join(config.service.output_dir, "mesh-edit", sid)
        ensure_dir(out_dir)
        output_path = os.path.join(out_dir, f"sanitized{ext}")

    def _run():
        return processor.sanitize_mesh(
            mesh_path, output_path=output_path, select_primary=select_primary
        )

    try:
        out_path, info = await asyncio.to_thread(_run)
        return {"success": True, "output_path": out_path, "info": info}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("sanitize_mesh failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/split-components", summary="拆分连通分量")
async def split_components(mesh_path: str = Form(..., description="输入网格路径")):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")

    processor = get_mesh_processor()

    def _run():
        mesh = processor._load_trimesh_mesh(mesh_path)
        comps = processor._split_components(mesh)
        return [_component_meta(i, c) for i, c in enumerate(comps)]

    try:
        components = await asyncio.to_thread(_run)
        return {"success": True, "mesh_path": mesh_path, "components": components}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("split_components failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/merge-components", summary="按 index 合并保留分量并导出")
async def merge_components(
    mesh_path: str = Form(...),
    keep_indices_json: str = Form(..., description='保留分量 index JSON，如 [0,2]'),
    output_path: Optional[str] = Form(None),
    output_format: str = Form("glb"),
):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")

    try:
        keep_indices = json.loads(keep_indices_json)
        if not isinstance(keep_indices, list):
            raise ValueError("keep_indices_json 必须为数组")
        keep_indices = [int(i) for i in keep_indices]
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"keep_indices_json 无效: {e}") from e

    fmt = _normalize_format(output_format)
    config = get_config()
    sid = uuid.uuid4().hex[:16]
    if not output_path:
        out_dir = os.path.join(config.service.output_dir, "mesh-edit", sid)
        ensure_dir(out_dir)
        output_path = os.path.join(out_dir, f"merged.{fmt}")

    processor = get_mesh_processor()

    def _run():
        mesh = processor._load_trimesh_mesh(mesh_path)
        comps = processor._split_components(mesh)
        merged = _merge_by_indices(comps, keep_indices)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        merged.export(output_path, file_type=fmt)
        return output_path, len(comps), len(merged.faces)

    try:
        out_path, total, face_count = await asyncio.to_thread(_run)
        return {
            "success": True,
            "output_path": out_path,
            "kept_indices": keep_indices,
            "source_component_count": total,
            "output_face_count": face_count,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("merge_components failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/clip-plane", summary="半空间剖切网格")
async def clip_plane(
    mesh_path: str = Form(...),
    plane_origin_json: str = Form(..., description='平面原点 [x,y,z]'),
    plane_normal_json: str = Form(..., description='平面法向 [x,y,z]'),
    keep_positive: bool = Form(True),
    output_path: Optional[str] = Form(None),
    output_format: str = Form("glb"),
):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")

    try:
        origin = json.loads(plane_origin_json)
        normal = json.loads(plane_normal_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"平面参数 JSON 无效: {e}") from e

    fmt = _normalize_format(output_format)
    config = get_config()
    sid = uuid.uuid4().hex[:16]
    if not output_path:
        out_dir = os.path.join(config.service.output_dir, "mesh-edit", sid)
        ensure_dir(out_dir)
        output_path = os.path.join(out_dir, f"clipped.{fmt}")

    processor = get_mesh_processor()

    def _run():
        mesh = processor._load_trimesh_mesh(mesh_path)
        clipped = _clip_mesh_halfspace(mesh, origin, normal, keep_positive=keep_positive)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        clipped.export(output_path, file_type=fmt)
        return output_path, len(clipped.faces)

    try:
        out_path, faces = await asyncio.to_thread(_run)
        return {"success": True, "output_path": out_path, "output_face_count": faces}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("clip_plane failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/export", summary="导出网格为指定格式")
async def export_mesh(
    mesh_path: str = Form(...),
    output_path: Optional[str] = Form(None),
    output_format: str = Form("glb"),
):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")

    fmt = _normalize_format(output_format)
    config = get_config()
    sid = uuid.uuid4().hex[:16]
    if not output_path:
        out_dir = os.path.join(config.service.output_dir, "mesh-edit", sid)
        ensure_dir(out_dir)
        output_path = os.path.join(out_dir, f"export.{fmt}")

    processor = get_mesh_processor()

    def _run():
        mesh = processor._load_trimesh_mesh(mesh_path)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        mesh.export(output_path, file_type=fmt)
        return output_path, len(mesh.faces)

    try:
        out_path, faces = await asyncio.to_thread(_run)
        return {"success": True, "output_path": out_path, "output_face_count": faces}
    except Exception as e:
        logger.error("export_mesh failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/boolean-difference", summary="布尔挖除 A−B（高级模式）")
async def boolean_difference(
    mesh_path: str = Form(...),
    subtract_mesh_path: str = Form(...),
    output_path: Optional[str] = Form(None),
    output_format: str = Form("glb"),
):
    if not mesh_path or not os.path.isfile(mesh_path):
        raise HTTPException(status_code=400, detail=f"网格不存在: {mesh_path}")
    if not subtract_mesh_path or not os.path.isfile(subtract_mesh_path):
        raise HTTPException(status_code=400, detail=f"减除网格不存在: {subtract_mesh_path}")

    fmt = _normalize_format(output_format)
    config = get_config()
    sid = uuid.uuid4().hex[:16]
    if not output_path:
        out_dir = os.path.join(config.service.output_dir, "mesh-edit", sid)
        ensure_dir(out_dir)
        output_path = os.path.join(out_dir, f"boolean.{fmt}")

    processor = get_mesh_processor()

    def _run():
        out = processor.boolean_difference(mesh_path, subtract_mesh_path, output_path)
        mesh = processor._load_trimesh_mesh(out)
        return out, len(mesh.faces)

    try:
        out_path, faces = await asyncio.to_thread(_run)
        return {"success": True, "output_path": out_path, "output_face_count": faces}
    except Exception as e:
        logger.error("boolean_difference failed: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e)) from e
