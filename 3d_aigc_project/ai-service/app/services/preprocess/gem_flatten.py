"""
宝石区域占位色预处理：检测 CAD/渲染图中的高亮或彩色宝石区域，填平坦色以降低混元 ShapeGen 对反光的误判。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# HSV 自动检测：覆盖超过该比例则拒绝（避免整件首饰被填色）
MAX_HSV_COVERAGE_RATIO = 0.50

# RGB 占位色（与金属灰/金有明显区分）
GEM_PRESET_COLORS: Dict[str, Tuple[int, int, int]] = {
    "ruby": (231, 76, 60),
    "sapphire": (52, 152, 219),
    "emerald": (46, 204, 113),
    "diamond": (168, 192, 214),
    "amethyst": (155, 89, 182),
}


class GemCoverageTooHighError(ValueError):
    """HSV 自动检测覆盖过高，应改用 SAM 点选。"""


@dataclass
class GemFlattenResult:
    image: Image.Image
    coverage_ratio: float
    preset: str
    method: str = "hsv"


def _resolve_color(preset: str, custom_hex: Optional[str] = None) -> Tuple[int, int, int]:
    if custom_hex:
        h = custom_hex.strip().lstrip("#")
        if len(h) == 6:
            return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
    key = (preset or "ruby").lower()
    return GEM_PRESET_COLORS.get(key, GEM_PRESET_COLORS["ruby"])


def _build_foreground_mask(rgba: np.ndarray) -> np.ndarray:
    if rgba.shape[2] == 4:
        alpha = rgba[:, :, 3]
        return alpha > 12
    gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return gray < 250


def detect_gem_mask(
    rgba: np.ndarray,
    sensitivity: float = 0.55,
) -> np.ndarray:
    """
    启发式检测宝石/高反光区域（适用于珠宝 CAD 线稿与渲染图）。

    - 白色钻石：高亮度 + 低饱和度
    - 彩色宝石：高饱和度 + 中高亮度
    - 强 specular：极高亮度小块
    """
    sensitivity = float(np.clip(sensitivity, 0.2, 0.95))
    rgb = rgba[:, :, :3]
    foreground = _build_foreground_mask(rgba)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    _, s, v = cv2.split(hsv)

    v_white = int(200 + (1.0 - sensitivity) * 35)
    s_white_max = int(25 + sensitivity * 35)
    mask_white = (v >= v_white) & (s <= s_white_max)

    s_color_min = int(55 + sensitivity * 40)
    v_color_min = int(85 + (1.0 - sensitivity) * 30)
    mask_color = (s >= s_color_min) & (v >= v_color_min)

    v_spec = int(235 + (1.0 - sensitivity) * 15)
    mask_spec = v >= v_spec

    mask = (mask_white | mask_color | mask_spec) & foreground

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask_u8 = (mask.astype(np.uint8) * 255)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_OPEN, kernel, iterations=1)

    # 去掉过小噪点
    min_area = max(48, int(foreground.sum() * 0.0008))
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_u8, connectivity=8)
    cleaned = np.zeros_like(mask_u8)
    for i in range(1, n_labels):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == i] = 255

    return cleaned > 0


def _apply_flat_color_to_mask(
    rgba: np.ndarray,
    mask: np.ndarray,
    preset: str,
    custom_color: Optional[str],
    preserve_edges: bool,
) -> None:
    color = _resolve_color(preset, custom_color)
    rgba[mask, 0] = color[0]
    rgba[mask, 1] = color[1]
    rgba[mask, 2] = color[2]
    rgba[mask, 3] = 255

    if preserve_edges:
        gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 70, 150)
        edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
        edge_on_gem = edges.astype(bool) & mask
        rgba[edge_on_gem, 0] = 45
        rgba[edge_on_gem, 1] = 45
        rgba[edge_on_gem, 2] = 55


def _coverage_ratio(mask: np.ndarray, rgba: np.ndarray) -> float:
    fg_pixels = max(int(_build_foreground_mask(rgba).sum()), 1)
    return float(mask.sum()) / fg_pixels


def segment_gem_auto(
    image: Image.Image,
    sensitivity: float = 0.55,
) -> Tuple[np.ndarray, float]:
    """
    自动检测宝石/反光区域蒙版（HSV 启发式），供占位色等严格场景使用。
    """
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    mask = detect_gem_mask(rgba, sensitivity=sensitivity)
    coverage = _coverage_ratio(mask, rgba)

    if coverage < 0.002:
        raise ValueError("未检测到明显宝石反光区域，请检查图像或使用 SAM 点选")

    if coverage > MAX_HSV_COVERAGE_RATIO:
        raise GemCoverageTooHighError(
            f"自动检测覆盖 {coverage * 100:.1f}% 超过 "
            f"{MAX_HSV_COVERAGE_RATIO * 100:.0f}%，请改用 SAM 点选指定主石区域。"
        )

    return mask, coverage


def estimate_gem_seed_point(rgba: np.ndarray) -> Tuple[float, float]:
    """估计主石中心（用于自动 SAM 点选），优先取前景上部中央。"""
    foreground = _build_foreground_mask(rgba)
    coords = np.argwhere(foreground)
    if coords.size == 0:
        h, w = rgba.shape[:2]
        return w * 0.5, h * 0.35

    coarse = detect_gem_mask(rgba, sensitivity=0.6)
    if coarse.any():
        refined = _refine_gem_mask_components(rgba, coarse)
        if refined.any():
            gem_coords = np.argwhere(refined)
            cy, cx = gem_coords.mean(axis=0)
            return float(cx), float(cy)

    ymin, xmin = coords.min(axis=0)
    ymax, xmax = coords.max(axis=0)
    cx = (xmin + xmax) * 0.5
    cy = ymin + (ymax - ymin) * 0.22
    return float(cx), float(cy)


def _refine_gem_mask_components(
    rgba: np.ndarray,
    coarse_mask: np.ndarray,
    max_component_coverage: float = 0.38,
) -> np.ndarray:
    """
    从 HSV 粗蒙版中选取最像「主石」的连通域。
    戒指/吊坠常见构图：主石位于前景包围盒偏上、居中，面积适中。
    """
    foreground = _build_foreground_mask(rgba)
    fg_coords = np.argwhere(foreground)
    if fg_coords.size == 0:
        return coarse_mask.astype(bool)

    ymin, xmin = fg_coords.min(axis=0)
    ymax, xmax = fg_coords.max(axis=0)
    fg_h = max(int(ymax - ymin + 1), 1)
    fg_w = max(int(xmax - xmin + 1), 1)
    fg_center_x = (xmin + xmax) * 0.5
    fg_pixels = max(int(foreground.sum()), 1)

    mask_u8 = (coarse_mask.astype(np.uint8) * 255)
    n_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        mask_u8, connectivity=8
    )

    candidates: list[tuple[float, int]] = []
    for i in range(1, n_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < 48:
            continue
        comp_cov = area / fg_pixels
        if comp_cov > max_component_coverage:
            continue
        cx, cy = centroids[i]
        upper_score = 1.0 - float(cy - ymin) / fg_h
        center_score = 1.0 - min(abs(cx - fg_center_x) / max(fg_w * 0.5, 1.0), 1.0)
        ideal_cov = 0.10
        size_score = 1.0 - min(abs(comp_cov - ideal_cov) / ideal_cov, 1.0)
        score = upper_score * 0.45 + center_score * 0.30 + size_score * 0.25
        candidates.append((score, i))

    if not candidates:
        upper_limit = ymin + fg_h * 0.55
        best_label = 0
        best_area = 0
        for i in range(1, n_labels):
            cy = centroids[i][1]
            area = int(stats[i, cv2.CC_STAT_AREA])
            if cy <= upper_limit and area > best_area:
                best_area = area
                best_label = i
        if best_label > 0:
            return labels == best_label
        return coarse_mask.astype(bool)

    candidates.sort(key=lambda x: x[0], reverse=True)
    return labels == candidates[0][1]


def segment_gem_for_repaint(
    image: Image.Image,
    sensitivity: float = 0.55,
) -> Tuple[np.ndarray, float, str]:
    """
    云端去反光专用：自动定位主石蒙版，HSV 过宽时精炼连通域，仍失败则 SAM 单点分割。
    返回 (mask, coverage, engine)。
    """
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    coarse = detect_gem_mask(rgba, sensitivity=sensitivity)
    coverage = _coverage_ratio(coarse, rgba)

    if coverage < 0.002:
        return _segment_gem_with_sam_auto(image, rgba)

    if coverage > MAX_HSV_COVERAGE_RATIO:
        refined = _refine_gem_mask_components(rgba, coarse)
        ref_cov = _coverage_ratio(refined, rgba)
        logger.info(
            "去反光 HSV 覆盖 %.1f%% 过高，精炼主石连通域 -> %.1f%%",
            coverage * 100,
            ref_cov * 100,
        )
        if 0.002 <= ref_cov <= 0.42:
            return refined, ref_cov, "hsv_refined"
        return _segment_gem_with_sam_auto(image, rgba)

    return coarse, coverage, "hsv_auto"


def _segment_gem_with_sam_auto(
    image: Image.Image,
    rgba: np.ndarray,
) -> Tuple[np.ndarray, float, str]:
    from app.services.preprocess.sam_gem_segment import (
        sam_model_available,
        sam_model_hint,
        segment_gem_with_points,
    )

    if not sam_model_available():
        raise ValueError(
            "无法自动定位主石区域，且本地 SAM 模型不可用。"
            + sam_model_hint()
        )

    cx, cy = estimate_gem_seed_point(rgba)
    seg = segment_gem_with_points(
        image,
        [{"x": cx, "y": cy, "label": 1}],
    )
    logger.info(
        "去反光自动 SAM 点选: (%.0f, %.0f) coverage=%.1f%%",
        cx,
        cy,
        seg.coverage_ratio * 100,
    )
    return seg.mask, seg.coverage_ratio, "sam_auto"


def flatten_gem_with_mask(
    image: Image.Image,
    mask: np.ndarray,
    preset: str = "ruby",
    custom_color: Optional[str] = None,
    preserve_edges: bool = True,
    method: str = "sam",
) -> GemFlattenResult:
    """使用外部 mask（如 SAM 点选）填平坦占位色。"""
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    if mask.shape[:2] != rgba.shape[:2]:
        raise ValueError("mask 尺寸与图像不一致")

    gem_mask = mask.astype(bool)
    coverage = _coverage_ratio(gem_mask, rgba)

    if coverage < 0.002:
        logger.warning("SAM mask 过小 (coverage=%.4f)", coverage)
        return GemFlattenResult(
            image=Image.fromarray(rgba),
            coverage_ratio=coverage,
            preset=preset,
            method=method,
        )

    _apply_flat_color_to_mask(rgba, gem_mask, preset, custom_color, preserve_edges)
    logger.info(
        "宝石占位色完成(%s): preset=%s coverage=%.2f%%",
        method,
        preset,
        coverage * 100,
    )
    return GemFlattenResult(
        image=Image.fromarray(rgba),
        coverage_ratio=coverage,
        preset=preset,
        method=method,
    )


def build_mask_overlay_preview(
    image: Image.Image,
    mask: np.ndarray,
    color: Tuple[int, int, int] = (46, 204, 113),
    alpha: float = 0.45,
) -> Image.Image:
    """生成蒙版预览叠加图（绿膜 + 原图）。"""
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    overlay = rgba.copy()
    a = int(np.clip(alpha, 0.05, 0.9) * 255)
    m = mask.astype(bool)
    overlay[m, 0] = ((1 - alpha) * overlay[m, 0] + alpha * color[0]).astype(np.uint8)
    overlay[m, 1] = ((1 - alpha) * overlay[m, 1] + alpha * color[1]).astype(np.uint8)
    overlay[m, 2] = ((1 - alpha) * overlay[m, 2] + alpha * color[2]).astype(np.uint8)
    overlay[m, 3] = np.maximum(overlay[m, 3], a)
    return Image.fromarray(overlay)


def flatten_gem_regions(
    image: Image.Image,
    preset: str = "ruby",
    custom_color: Optional[str] = None,
    sensitivity: float = 0.55,
    preserve_edges: bool = True,
) -> GemFlattenResult:
    """HSV 启发式检测宝石区域并填平坦占位色。"""
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    mask = detect_gem_mask(rgba, sensitivity=sensitivity)
    coverage = _coverage_ratio(mask, rgba)

    if coverage < 0.002:
        logger.warning("未检测到明显宝石区域 (coverage=%.4f)", coverage)
        return GemFlattenResult(
            image=Image.fromarray(rgba),
            coverage_ratio=coverage,
            preset=preset,
            method="hsv",
        )

    if coverage > MAX_HSV_COVERAGE_RATIO:
        raise GemCoverageTooHighError(
            f"自动检测覆盖 {coverage * 100:.1f}% 超过 "
            f"{MAX_HSV_COVERAGE_RATIO * 100:.0f}%，金属高光可能被误判。"
            f"请使用「SAM 点选宝石」手动指定主石区域。"
        )

    _apply_flat_color_to_mask(rgba, mask, preset, custom_color, preserve_edges)
    logger.info(
        "宝石占位色完成(hsv): preset=%s coverage=%.2f%% pixels=%d",
        preset,
        coverage * 100,
        int(mask.sum()),
    )
    return GemFlattenResult(
        image=Image.fromarray(rgba),
        coverage_ratio=coverage,
        preset=preset,
        method="hsv",
    )
