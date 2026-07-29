"""
预处理管线：按步骤类型调度可插拔处理器
"""

import logging
import os
import uuid
from typing import Dict, Optional

from PIL import Image

from app.config import get_config
from app.services.preprocess.gem_flatten_step import GemFlattenStep
from app.services.preprocess.gem_repaint_step import GemRepaintStep
from app.services.preprocess.remove_background import RemoveBackgroundStep
from app.services.preprocess.types import PreprocessStepType
from app.utils.file_utils import ensure_dir, validate_image_file

logger = logging.getLogger(__name__)

_STEP_REGISTRY = {
    PreprocessStepType.REMOVE_BACKGROUND: RemoveBackgroundStep(),
    PreprocessStepType.GEM_FLATTEN: GemFlattenStep(),
    PreprocessStepType.GEM_REPAINT: GemRepaintStep(),
}


def get_preprocess_output_dir() -> str:
    config = get_config()
    path = os.path.join(config.service.output_dir, "preprocess")
    return ensure_dir(path)


def run_preprocess_step(
    step: PreprocessStepType,
    image: Image.Image,
    **kwargs,
) -> Image.Image:
    processor = _STEP_REGISTRY.get(step)
    if processor is None:
        raise ValueError(f"不支持的预处理步骤: {step}")
    result = processor.process(image, **kwargs)
    return result["processed_image"]


def save_preprocess_result(
    image: Image.Image,
    session_id: Optional[str] = None,
    filename: str = "no_bg.png",
) -> Dict[str, str]:
    """
    保存预处理结果并返回路径信息

    Returns:
        session_id, processed_path, preview_url
    """
    session_id = session_id or uuid.uuid4().hex[:16]
    out_dir = os.path.join(get_preprocess_output_dir(), session_id)
    ensure_dir(out_dir)

    processed_path = os.path.join(out_dir, filename)
    image.save(processed_path, format="PNG")
    logger.info("预处理结果已保存: %s", processed_path)

    preview_url = f"/outputs/preprocess/{session_id}/{filename}"
    return {
        "session_id": session_id,
        "processed_path": processed_path,
        "preview_url": preview_url,
    }


def remove_background_from_path(
    image_path: str,
    session_id: Optional[str] = None,
) -> Dict[str, str]:
    if not validate_image_file(image_path):
        raise ValueError(f"无效的图像文件: {image_path}")

    with Image.open(image_path) as img:
        source = img.convert("RGBA")

    processed = run_preprocess_step(PreprocessStepType.REMOVE_BACKGROUND, source)
    return save_preprocess_result(processed, session_id=session_id)


def remove_background_from_image(
    image: Image.Image,
    session_id: Optional[str] = None,
) -> Dict[str, str]:
    processed = run_preprocess_step(PreprocessStepType.REMOVE_BACKGROUND, image)
    return save_preprocess_result(processed, session_id=session_id)


def gem_flatten_from_path(
    image_path: str,
    session_id: Optional[str] = None,
    gem_preset: str = "ruby",
    custom_color: Optional[str] = None,
    sensitivity: float = 0.55,
    preserve_edges: bool = True,
) -> Dict[str, object]:
    if not validate_image_file(image_path):
        raise ValueError(f"无效的图像文件: {image_path}")

    with Image.open(image_path) as img:
        source = img.convert("RGBA")

    processor = _STEP_REGISTRY[PreprocessStepType.GEM_FLATTEN]
    result = processor.process(
        source,
        gem_preset=gem_preset,
        custom_color=custom_color,
        sensitivity=sensitivity,
        preserve_edges=preserve_edges,
    )
    saved = save_preprocess_result(
        result["processed_image"],
        session_id=session_id,
        filename="gem_flat.png",
    )
    saved["gem_coverage_ratio"] = result.get("gem_coverage_ratio", 0.0)
    saved["gem_preset"] = result.get("gem_preset", gem_preset)
    saved["segment_method"] = result.get("segment_method", "hsv")
    return saved


def gem_flatten_from_image(
    image: Image.Image,
    session_id: Optional[str] = None,
    gem_preset: str = "ruby",
    custom_color: Optional[str] = None,
    sensitivity: float = 0.55,
    preserve_edges: bool = True,
) -> Dict[str, object]:
    processor = _STEP_REGISTRY[PreprocessStepType.GEM_FLATTEN]
    result = processor.process(
        image.convert("RGBA"),
        gem_preset=gem_preset,
        custom_color=custom_color,
        sensitivity=sensitivity,
        preserve_edges=preserve_edges,
    )
    saved = save_preprocess_result(
        result["processed_image"],
        session_id=session_id,
        filename="gem_flat.png",
    )
    saved["gem_coverage_ratio"] = result.get("gem_coverage_ratio", 0.0)
    saved["gem_preset"] = result.get("gem_preset", gem_preset)
    saved["segment_method"] = result.get("segment_method", "hsv")
    return saved


def split_multi_view_from_path(
    image_path: str,
    session_id: Optional[str] = None,
) -> Dict[str, object]:
    """切分多视图合一 CAD 图，保存各 crop 并返回元数据"""
    from app.services.preprocess.split_multi_view import split_multi_view_sheet

    if not validate_image_file(image_path):
        raise ValueError(f"无效的图像文件: {image_path}")

    session_id = session_id or uuid.uuid4().hex[:16]
    out_dir = os.path.join(get_preprocess_output_dir(), session_id)
    ensure_dir(out_dir)

    with Image.open(image_path) as img:
        source = img.convert("RGBA")
        width, height = source.size
        crops_meta, crop_images = split_multi_view_sheet(source)

    crop_items = []
    for meta, crop_img in zip(crops_meta, crop_images):
        filename = f"{meta.id}.png"
        processed_path = os.path.join(out_dir, filename)
        crop_img.save(processed_path, format="PNG")
        crop_items.append(
            {
                "id": meta.id,
                "x": meta.x,
                "y": meta.y,
                "width": meta.width,
                "height": meta.height,
                "guess": meta.guess,
                "processed_path": processed_path,
                "preview_url": f"/outputs/preprocess/{session_id}/{filename}",
            }
        )

    return {
        "session_id": session_id,
        "source_width": width,
        "source_height": height,
        "original_path": image_path,
        "crops": crop_items,
    }


def split_multi_view_from_image(
    image: Image.Image,
    session_id: Optional[str] = None,
) -> Dict[str, object]:
    session_id = session_id or uuid.uuid4().hex[:16]
    out_dir = os.path.join(get_preprocess_output_dir(), session_id)
    ensure_dir(out_dir)
    input_path = os.path.join(out_dir, "sheet_input.png")
    image.convert("RGBA").save(input_path, format="PNG")
    return split_multi_view_from_path(input_path, session_id=session_id)


def _save_gem_mask_artifacts(
    session_id: str,
    mask: "np.ndarray",
    overlay: Image.Image,
) -> Dict[str, str]:
    import numpy as np

    out_dir = os.path.join(get_preprocess_output_dir(), session_id)
    ensure_dir(out_dir)
    mask_path = os.path.join(out_dir, "gem_mask.png")
    overlay_path = os.path.join(out_dir, "gem_mask_overlay.png")
    Image.fromarray((mask.astype(np.uint8) * 255)).save(mask_path, format="PNG")
    overlay.save(overlay_path, format="PNG")
    return {
        "mask_path": mask_path,
        "mask_preview_url": f"/outputs/preprocess/{session_id}/gem_mask_overlay.png",
    }


def gem_segment_auto_from_image(
    image: Image.Image,
    session_id: Optional[str] = None,
    sensitivity: float = 0.55,
    mask_dilate_px: int = 8,
) -> Dict[str, object]:
    """自动分割主石区域，供云端整图去反光（无需用户点选）。"""
    from app.services.preprocess.gem_flatten import (
        build_mask_overlay_preview,
        segment_gem_for_repaint,
    )
    from app.services.preprocess.gem_repaint import _dilate_mask

    session_id = session_id or uuid.uuid4().hex[:16]
    source = image.convert("RGBA")
    mask, coverage, engine = segment_gem_for_repaint(source, sensitivity=sensitivity)
    if mask_dilate_px > 0:
        mask = _dilate_mask(mask, mask_dilate_px)
    overlay = build_mask_overlay_preview(source, mask)
    artifacts = _save_gem_mask_artifacts(session_id, mask, overlay)

    return {
        "session_id": session_id,
        "gem_coverage_ratio": coverage,
        "segment_engine": engine,
        **artifacts,
    }


def gem_segment_sam_from_image(
    image: Image.Image,
    points: list,
    session_id: Optional[str] = None,
    mask_dilate_px: int = 0,
) -> Dict[str, object]:
    from app.services.preprocess.gem_flatten import build_mask_overlay_preview
    from app.services.preprocess.sam_gem_segment import (
        sam_model_available,
        sam_model_hint,
        segment_gem_with_points,
    )

    if not sam_model_available():
        raise ValueError(sam_model_hint())

    session_id = session_id or uuid.uuid4().hex[:16]
    source = image.convert("RGBA")
    seg = segment_gem_with_points(source, points)
    mask = seg.mask
    if mask_dilate_px > 0:
        from app.services.preprocess.gem_repaint import _dilate_mask
        mask = _dilate_mask(mask, mask_dilate_px)
    overlay = build_mask_overlay_preview(source, mask)
    artifacts = _save_gem_mask_artifacts(session_id, mask, overlay)

    return {
        "session_id": session_id,
        "gem_coverage_ratio": seg.coverage_ratio,
        "segment_engine": seg.engine,
        **artifacts,
    }


def gem_flatten_sam_from_image(
    image: Image.Image,
    points: list,
    session_id: Optional[str] = None,
    gem_preset: str = "ruby",
    custom_color: Optional[str] = None,
    preserve_edges: bool = True,
) -> Dict[str, object]:
    from app.services.preprocess.gem_flatten import (
        build_mask_overlay_preview,
        flatten_gem_with_mask,
    )
    from app.services.preprocess.sam_gem_segment import (
        sam_model_available,
        sam_model_hint,
        segment_gem_with_points,
    )

    if not sam_model_available():
        raise ValueError(sam_model_hint())

    session_id = session_id or uuid.uuid4().hex[:16]
    source = image.convert("RGBA")
    seg = segment_gem_with_points(source, points)
    result = flatten_gem_with_mask(
        source,
        seg.mask,
        preset=gem_preset,
        custom_color=custom_color,
        preserve_edges=preserve_edges,
        method=seg.engine,
    )

    overlay = build_mask_overlay_preview(source, seg.mask)
    _save_gem_mask_artifacts(session_id, seg.mask, overlay)

    saved = save_preprocess_result(
        result.image,
        session_id=session_id,
        filename="gem_flat.png",
    )
    saved["gem_coverage_ratio"] = result.coverage_ratio
    saved["gem_preset"] = result.preset
    saved["segment_method"] = result.method
    saved["segment_engine"] = seg.engine
    saved["mask_preview_url"] = f"/outputs/preprocess/{session_id}/gem_mask_overlay.png"
    return saved


def gem_repaint_sam_from_image(
    image: Image.Image,
    points: list,
    session_id: Optional[str] = None,
    prompt: Optional[str] = None,
    strength: float = 0.45,
    preserve_edges: bool = True,
    mask_dilate_px: int = 8,
    seed: Optional[int] = None,
) -> Dict[str, object]:
    from app.config import get_config
    from app.services.preprocess.gem_flatten import build_mask_overlay_preview
    from app.services.preprocess.gem_repaint import repaint_gem_with_mask
    from app.services.preprocess.sam_gem_segment import (
        sam_model_available,
        sam_model_hint,
        segment_gem_with_points,
    )

    if not get_config().gem_repaint.enabled:
        raise ValueError("宝石去反光重绘未启用，请设置 ENABLE_GEM_REPAINT=1")

    if not sam_model_available():
        raise ValueError(sam_model_hint())

    session_id = session_id or uuid.uuid4().hex[:16]
    source = image.convert("RGBA")
    seg = segment_gem_with_points(source, points)
    result = repaint_gem_with_mask(
        source,
        seg.mask,
        prompt=prompt,
        strength=strength,
        preserve_edges=preserve_edges,
        mask_dilate_px=mask_dilate_px,
        seed=seed,
        segment_method=seg.engine,
    )

    overlay = build_mask_overlay_preview(source, seg.mask)
    _save_gem_mask_artifacts(session_id, seg.mask, overlay)

    saved = save_preprocess_result(
        result.image,
        session_id=session_id,
        filename="gem_repaint.png",
    )
    saved["gem_coverage_ratio"] = result.coverage_ratio
    saved["segment_method"] = result.segment_method
    saved["repaint_method"] = result.repaint_method
    saved["segment_engine"] = seg.engine
    saved["mask_preview_url"] = f"/outputs/preprocess/{session_id}/gem_mask_overlay.png"
    return saved
