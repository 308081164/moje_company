"""
预处理管线：按步骤类型调度可插拔处理器
"""

import logging
import os
import uuid
from typing import Dict, Optional

from PIL import Image

from app.config import get_config
from app.services.preprocess.remove_background import RemoveBackgroundStep
from app.services.preprocess.types import PreprocessStepType
from app.utils.file_utils import ensure_dir, validate_image_file

logger = logging.getLogger(__name__)

_STEP_REGISTRY = {
    PreprocessStepType.REMOVE_BACKGROUND: RemoveBackgroundStep(),
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
