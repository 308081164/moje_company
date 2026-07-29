"""
网格格式转换 API
"""

import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Form, HTTPException

from app.config import get_config
from app.models.schemas import MeshConvertResponse
from app.services.mesh_processor import get_mesh_processor
from app.utils.file_utils import ensure_dir

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mesh", tags=["网格转换"])

SUPPORTED_FORMATS = {"obj", "glb", "stl"}


def _normalize_format(value: str) -> str:
    fmt = (value or "").strip().lower().lstrip(".")
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的格式: {value}，支持: {', '.join(sorted(SUPPORTED_FORMATS))}",
        )
    return fmt


@router.get(
    "/formats",
    summary="支持的网格格式",
    description="返回系统支持的网格格式列表",
)
async def list_formats():
    return {
        "formats": sorted(SUPPORTED_FORMATS),
        "matrix": {
            src: sorted(SUPPORTED_FORMATS - {src}) for src in SUPPORTED_FORMATS
        },
    }


@router.post(
    "/convert",
    response_model=MeshConvertResponse,
    summary="网格格式转换",
    description="将 OBJ/GLB/STL 网格互转为目标格式",
)
async def convert_mesh(
    input_path: str = Form(..., description="输入网格本地路径"),
    output_format: str = Form(..., description="目标格式 obj/glb/stl"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    output_path: Optional[str] = Form(None, description="可选输出路径，默认写入 outputs/mesh-convert/{session}/converted.{fmt}"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    fmt = _normalize_format(output_format)

    if not input_path or not os.path.isfile(input_path):
        raise HTTPException(status_code=400, detail=f"输入文件不存在: {input_path}")

    input_ext = Path(input_path).suffix.lower().lstrip(".")
    if input_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的源格式: .{input_ext}，支持: {', '.join(sorted(SUPPORTED_FORMATS))}",
        )
    if input_ext == fmt:
        raise HTTPException(status_code=400, detail="源格式与目标格式相同，无需转换")

    config = get_config()
    if output_path:
        out_path = output_path
    else:
        out_dir = os.path.join(config.service.output_dir, "mesh-convert", sid)
        ensure_dir(out_dir)
        out_path = os.path.join(out_dir, f"converted.{fmt}")

    processor = get_mesh_processor()

    def _convert():
        return processor.convert_format(input_path, out_path, output_format=fmt)

    try:
        result_path = await asyncio.to_thread(_convert)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.exception("网格格式转换失败")
        raise HTTPException(status_code=500, detail=f"格式转换失败: {e}") from e

    vertex_count = 0
    face_count = 0
    try:
        import trimesh

        loaded = trimesh.load(result_path, force="mesh")
        if hasattr(loaded, "vertices"):
            vertex_count = len(loaded.vertices)
            face_count = len(loaded.faces)
    except Exception:
        logger.debug("无法统计转换后网格顶点/面数", exc_info=True)

    return MeshConvertResponse(
        success=True,
        session_id=sid,
        input_path=input_path,
        output_path=result_path,
        output_format=fmt,
        vertex_count=vertex_count,
        face_count=face_count,
    )
