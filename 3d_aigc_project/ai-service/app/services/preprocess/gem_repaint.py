"""
宝石去反光 AI 重绘：SAM 蒙版 + InstructPix2Pix 局部合成
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_PROMPT = (
    "make the gemstone matte and diffuse, remove specular highlights, "
    "keep facet structure and color, do not change metal or prongs"
)


@dataclass
class GemRepaintResult:
    image: Image.Image
    coverage_ratio: float
    segment_method: str
    repaint_method: str = "ip2p"


def _coverage_ratio(mask: np.ndarray, rgba: np.ndarray) -> float:
    from app.services.preprocess.gem_flatten import _build_foreground_mask

    fg_pixels = max(int(_build_foreground_mask(rgba).sum()), 1)
    return float(mask.astype(bool).sum()) / fg_pixels


def _dilate_mask(mask: np.ndarray, dilate_px: int) -> np.ndarray:
    if dilate_px <= 0:
        return mask.astype(bool)
    k = max(3, dilate_px * 2 + 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    m = (mask.astype(np.uint8) * 255)
    m = cv2.dilate(m, kernel, iterations=1)
    return m > 0


def _feather_mask(mask: np.ndarray, feather_px: int = 6) -> np.ndarray:
    m = mask.astype(np.float32)
    if feather_px > 0:
        k = max(3, feather_px * 2 + 1)
        m = cv2.GaussianBlur(m, (k, k), 0)
    return np.clip(m, 0.0, 1.0)


def _preserve_edges_blend(
    original_rgb: np.ndarray,
    repainted_rgb: np.ndarray,
    gem_mask: np.ndarray,
) -> np.ndarray:
    gray = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 150)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
    edge_on_gem = edges.astype(bool) & gem_mask.astype(bool)
    out = repainted_rgb.copy()
    out[edge_on_gem] = original_rgb[edge_on_gem]
    return out


def composite_repainted_region(
    original: Image.Image,
    repainted: Image.Image,
    mask: np.ndarray,
    *,
    preserve_edges: bool = True,
    feather_px: int = 6,
) -> Image.Image:
    """仅在 mask 区域采用重绘结果，外部保持原图。"""
    orig_rgba = np.array(original.convert("RGBA"), dtype=np.uint8)
    rep_rgb = np.array(repainted.convert("RGB"), dtype=np.uint8)
    orig_rgb = orig_rgba[:, :, :3]

    if rep_rgb.shape[:2] != orig_rgb.shape[:2]:
        rep_rgb = np.array(
            repainted.convert("RGB").resize(
                (orig_rgb.shape[1], orig_rgb.shape[0]),
                Image.Resampling.LANCZOS,
            ),
            dtype=np.uint8,
        )

    gem_mask = mask.astype(bool)
    alpha = _feather_mask(gem_mask, feather_px=feather_px)[..., np.newaxis]
    blended_rgb = (
        orig_rgb.astype(np.float32) * (1.0 - alpha)
        + rep_rgb.astype(np.float32) * alpha
    ).astype(np.uint8)

    if preserve_edges:
        blended_rgb = _preserve_edges_blend(orig_rgb, blended_rgb, gem_mask)

    out = orig_rgba.copy()
    out[:, :, :3] = blended_rgb
    return Image.fromarray(out)


def repaint_gem_with_mask(
    image: Image.Image,
    mask: np.ndarray,
    *,
    prompt: Optional[str] = None,
    strength: float = 0.45,
    preserve_edges: bool = True,
    mask_dilate_px: int = 8,
    seed: Optional[int] = None,
    segment_method: str = "sam2",
) -> GemRepaintResult:
    from app.services.repaint_model_manager import get_repaint_model_manager

    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    if mask.shape[:2] != rgba.shape[:2]:
        raise ValueError("mask 尺寸与图像不一致")

    gem_mask = _dilate_mask(mask, mask_dilate_px)
    coverage = _coverage_ratio(gem_mask, rgba)
    if coverage < 0.002:
        logger.warning("宝石蒙版过小 (coverage=%.4f)，跳过重绘", coverage)
        return GemRepaintResult(
            image=Image.fromarray(rgba),
            coverage_ratio=coverage,
            segment_method=segment_method,
        )

    rgb_pil = Image.fromarray(rgba[:, :, :3], mode="RGB")
    manager = get_repaint_model_manager()
    try:
        repainted = manager.repaint(
            rgb_pil,
            prompt=prompt or DEFAULT_PROMPT,
            strength=strength,
            seed=seed,
            num_inference_steps=max(12, int(16 + strength * 12)),
            image_guidance_scale=1.2 + (1.0 - strength) * 0.8,
        )
        result_img = composite_repainted_region(
            Image.fromarray(rgba),
            repainted,
            gem_mask,
            preserve_edges=preserve_edges,
        )
    finally:
        manager.unload()

    logger.info(
        "宝石去反光重绘完成: coverage=%.2f%% method=%s strength=%.2f",
        coverage * 100,
        segment_method,
        strength,
    )
    return GemRepaintResult(
        image=result_img,
        coverage_ratio=coverage,
        segment_method=segment_method,
        repaint_method="ip2p",
    )
