"""
图像预处理 API（建模前处理）
"""

import asyncio
import logging
import os
import uuid
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from app.models.schemas import RemoveBackgroundResponse, SplitMultiViewResponse
from app.services.preprocess.pipeline import (
    remove_background_from_image,
    remove_background_from_path,
    split_multi_view_from_image,
    split_multi_view_from_path,
)
from app.utils.file_utils import ensure_dir, validate_image_file
from app.config import get_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/preprocess", tags=["图像预处理"])


@router.post(
    "/remove-background",
    response_model=RemoveBackgroundResponse,
    summary="一键扣除背景",
    description="建模前预处理：扣除图像背景，输出带透明通道的 PNG，供后续 image-to-3d 使用",
)
async def remove_background(
    file: Optional[UploadFile] = File(None, description="上传图像文件"),
    image_path: Optional[str] = Form(None, description="本地图像路径（与业务层联调）"),
    session_id: Optional[str] = Form(None, description="可选会话 ID，用于关联预览"),
):
    sid = session_id or uuid.uuid4().hex[:16]

    try:
        if file is not None and file.filename:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="上传文件为空")

            config = get_config()
            upload_dir = os.path.join(config.service.output_dir, "preprocess", sid)
            ensure_dir(upload_dir)
            ext = Path(file.filename).suffix.lower() or ".png"
            saved_path = os.path.join(upload_dir, f"input{ext}")
            with open(saved_path, "wb") as f:
                f.write(content)

            def _process_upload():
                with Image.open(saved_path) as img:
                    source = img.convert("RGBA")
                return remove_background_from_image(source, session_id=sid)

            result = await asyncio.to_thread(_process_upload)
            result["original_path"] = saved_path
            return RemoveBackgroundResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")
            result = await asyncio.to_thread(
                remove_background_from_path, image_path, sid
            )
            result["original_path"] = image_path
            return RemoveBackgroundResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("背景扣除失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"背景扣除失败: {e}")


@router.post(
    "/split-multi-view",
    response_model=SplitMultiViewResponse,
    summary="切分多视图合一 CAD 图",
    description="从一张珠宝 CAD 参考图中自动检测并裁剪多个视角区域",
)
async def split_multi_view(
    file: Optional[UploadFile] = File(None, description="上传合一 CAD 图"),
    image_path: Optional[str] = Form(None, description="本地图像路径（业务层联调）"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
):
    sid = session_id or uuid.uuid4().hex[:16]

    try:
        if file is not None and file.filename:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="上传文件为空")

            with Image.open(io.BytesIO(content)) as img:
                source = img.convert("RGBA")
            result = await asyncio.to_thread(
                split_multi_view_from_image, source, sid
            )
            return SplitMultiViewResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")
            result = await asyncio.to_thread(
                split_multi_view_from_path, image_path, sid
            )
            return SplitMultiViewResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("多视图切分失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"多视图切分失败: {e}")
