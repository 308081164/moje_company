"""
图像预处理 API（建模前处理）
"""

import json
import asyncio
import logging
import os
import uuid
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image

from app.models.schemas import (
    GemFlattenResponse,
    GemRepaintResponse,
    GemSegmentSamResponse,
    RemoveBackgroundResponse,
    SplitMultiViewResponse,
)
from app.services.preprocess.pipeline import (
    gem_flatten_from_image,
    gem_flatten_from_path,
    gem_flatten_sam_from_image,
    gem_repaint_sam_from_image,
    gem_segment_auto_from_image,
    gem_segment_sam_from_image,
    remove_background_from_image,
    remove_background_from_path,
    split_multi_view_from_image,
    split_multi_view_from_path,
)
from app.services.preprocess.gem_flatten import GemCoverageTooHighError
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


@router.post(
    "/gem-flatten",
    response_model=GemFlattenResponse,
    summary="宝石占位色",
    description="检测反光/彩色宝石区域并填平坦占位色，降低混元3D对高光误判",
)
async def gem_flatten(
    file: Optional[UploadFile] = File(None, description="上传图像"),
    image_path: Optional[str] = Form(None, description="本地图像路径"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    gem_preset: str = Form("ruby", description="占位色预设: ruby/sapphire/emerald/diamond/amethyst"),
    custom_color: Optional[str] = Form(None, description="自定义 hex 色，如 #E74C3C"),
    sensitivity: float = Form(0.55, description="检测灵敏度 0.2~0.95"),
    preserve_edges: bool = Form(True, description="是否保留宝石棱线"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    preset = (gem_preset or "ruby").strip().lower()
    if preset not in ("ruby", "sapphire", "emerald", "diamond", "amethyst"):
        preset = "ruby"
    sens = float(max(0.2, min(0.95, sensitivity)))

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
                return gem_flatten_from_image(
                    source,
                    session_id=sid,
                    gem_preset=preset,
                    custom_color=custom_color,
                    sensitivity=sens,
                    preserve_edges=preserve_edges,
                )

            result = await asyncio.to_thread(_process_upload)
            result["original_path"] = saved_path
            return GemFlattenResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")
            result = await asyncio.to_thread(
                gem_flatten_from_path,
                image_path,
                sid,
                preset,
                custom_color,
                sens,
                preserve_edges,
            )
            result["original_path"] = image_path
            return GemFlattenResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except GemCoverageTooHighError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("宝石占位色失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"宝石占位色失败: {e}")


def _parse_points_json(points_json: str) -> list:
    if not points_json or not points_json.strip():
        raise HTTPException(status_code=400, detail="请提供 points_json 点选坐标")
    try:
        data = json.loads(points_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"points_json 格式错误: {e}") from e
    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="points_json 必须为数组")
    return data


@router.post(
    "/gem-segment-sam",
    response_model=GemSegmentSamResponse,
    summary="SAM 点选宝石蒙版预览",
    description="根据用户点击坐标分割宝石区域，返回蒙版叠加预览图",
)
async def gem_segment_sam(
    file: Optional[UploadFile] = File(None, description="上传图像"),
    image_path: Optional[str] = Form(None, description="本地图像路径"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    points_json: str = Form(..., description='点坐标 JSON，如 [{"x":120,"y":200,"label":1}]'),
    mask_dilate_px: int = Form(0, description="蒙版膨胀像素（云端重绘用）"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    points = _parse_points_json(points_json)
    dilate_val = max(0, min(32, int(mask_dilate_px)))

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
                result = gem_segment_sam_from_image(source, points, session_id=sid, mask_dilate_px=dilate_val)
                result["original_path"] = saved_path
                return result

            result = await asyncio.to_thread(_process_upload)
            return GemSegmentSamResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")

            def _process_path():
                with Image.open(image_path) as img:
                    source = img.convert("RGBA")
                result = gem_segment_sam_from_image(source, points, session_id=sid, mask_dilate_px=dilate_val)
                result["original_path"] = image_path
                return result

            result = await asyncio.to_thread(_process_path)
            return GemSegmentSamResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("SAM 宝石蒙版预览失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"SAM 宝石蒙版预览失败: {e}")


@router.post(
    "/gem-segment-auto",
    response_model=GemSegmentSamResponse,
    summary="自动检测宝石蒙版（HSV）",
    description="无需点选，自动检测宝石/反光区域，供云端整图去反光",
)
async def gem_segment_auto(
    file: Optional[UploadFile] = File(None, description="上传图像"),
    image_path: Optional[str] = Form(None, description="本地图像路径"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    sensitivity: float = Form(0.55, description="检测灵敏度 0.2-0.95"),
    mask_dilate_px: int = Form(8, description="蒙版膨胀像素"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    sens = float(max(0.2, min(0.95, sensitivity)))
    dilate_val = max(0, min(32, int(mask_dilate_px)))

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
                result = gem_segment_auto_from_image(
                    source, session_id=sid, sensitivity=sens, mask_dilate_px=dilate_val
                )
                result["original_path"] = saved_path
                return result

            result = await asyncio.to_thread(_process_upload)
            return GemSegmentSamResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")

            def _process_path():
                with Image.open(image_path) as img:
                    source = img.convert("RGBA")
                result = gem_segment_auto_from_image(
                    source, session_id=sid, sensitivity=sens, mask_dilate_px=dilate_val
                )
                result["original_path"] = image_path
                return result

            result = await asyncio.to_thread(_process_path)
            return GemSegmentSamResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except GemCoverageTooHighError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("自动宝石蒙版失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"自动宝石蒙版失败: {e}")


@router.post(
    "/gem-flatten-sam",
    response_model=GemFlattenResponse,
    summary="SAM 点选宝石占位色",
    description="根据点选坐标分割宝石并填平坦占位色",
)
async def gem_flatten_sam(
    file: Optional[UploadFile] = File(None, description="上传图像"),
    image_path: Optional[str] = Form(None, description="本地图像路径"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    points_json: str = Form(..., description='点坐标 JSON，如 [{"x":120,"y":200,"label":1}]'),
    gem_preset: str = Form("ruby", description="占位色预设"),
    custom_color: Optional[str] = Form(None, description="自定义 hex 色"),
    preserve_edges: bool = Form(True, description="是否保留宝石棱线"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    preset = (gem_preset or "ruby").strip().lower()
    if preset not in ("ruby", "sapphire", "emerald", "diamond", "amethyst"):
        preset = "ruby"
    points = _parse_points_json(points_json)

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
                result = gem_flatten_sam_from_image(
                    source,
                    points,
                    session_id=sid,
                    gem_preset=preset,
                    custom_color=custom_color,
                    preserve_edges=preserve_edges,
                )
                result["original_path"] = saved_path
                return result

            result = await asyncio.to_thread(_process_upload)
            return GemFlattenResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")

            def _process_path():
                with Image.open(image_path) as img:
                    source = img.convert("RGBA")
                result = gem_flatten_sam_from_image(
                    source,
                    points,
                    session_id=sid,
                    gem_preset=preset,
                    custom_color=custom_color,
                    preserve_edges=preserve_edges,
                )
                result["original_path"] = image_path
                return result

            result = await asyncio.to_thread(_process_path)
            return GemFlattenResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("SAM 宝石占位色失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"SAM 宝石占位色失败: {e}")


@router.post(
    "/gem-repaint",
    response_model=GemRepaintResponse,
    summary="SAM 点选宝石去反光 AI 重绘",
    description="已迁移至 business-service 云端万相；此端点仅保留 SAM 分割 + 本地 Ip2p（ENABLE_GEM_REPAINT=1 时）",
)
async def gem_repaint(
    file: Optional[UploadFile] = File(None, description="上传图像"),
    image_path: Optional[str] = Form(None, description="本地图像路径"),
    session_id: Optional[str] = Form(None, description="可选会话 ID"),
    points_json: str = Form(..., description='点坐标 JSON，如 [{"x":120,"y":200,"label":1}]'),
    prompt: Optional[str] = Form(None, description="重绘指令（可选）"),
    strength: float = Form(0.45, description="重绘强度 0.1~1.0"),
    mask_dilate_px: int = Form(8, description="蒙版膨胀像素"),
    preserve_edges: bool = Form(True, description="是否保留宝石棱线"),
    seed: Optional[int] = Form(None, description="随机种子（多视图一致）"),
):
    sid = session_id or uuid.uuid4().hex[:16]
    points = _parse_points_json(points_json)
    cfg = get_config().gem_repaint
    if not cfg.enabled:
        raise HTTPException(status_code=503, detail="宝石去反光重绘未启用（ENABLE_GEM_REPAINT=0）")

    strength_val = float(max(0.1, min(1.0, strength)))
    dilate_val = max(0, min(32, int(mask_dilate_px)))
    seed_val = seed if seed is not None else cfg.default_seed
    prompt_val = (prompt or cfg.default_prompt).strip() or None

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
                result = gem_repaint_sam_from_image(
                    source,
                    points,
                    session_id=sid,
                    prompt=prompt_val,
                    strength=strength_val,
                    preserve_edges=preserve_edges,
                    mask_dilate_px=dilate_val,
                    seed=seed_val,
                )
                result["original_path"] = saved_path
                return result

            result = await asyncio.to_thread(_process_upload)
            return GemRepaintResponse(success=True, **result)

        if image_path:
            if not validate_image_file(image_path):
                raise HTTPException(status_code=400, detail=f"无效的图像路径: {image_path}")

            def _process_path():
                with Image.open(image_path) as img:
                    source = img.convert("RGBA")
                result = gem_repaint_sam_from_image(
                    source,
                    points,
                    session_id=sid,
                    prompt=prompt_val,
                    strength=strength_val,
                    preserve_edges=preserve_edges,
                    mask_dilate_px=dilate_val,
                    seed=seed_val,
                )
                result["original_path"] = image_path
                return result

            result = await asyncio.to_thread(_process_path)
            return GemRepaintResponse(success=True, **result)

        raise HTTPException(status_code=400, detail="请提供 file 或 image_path")

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("宝石去反光重绘失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"宝石去反光重绘失败: {e}")
