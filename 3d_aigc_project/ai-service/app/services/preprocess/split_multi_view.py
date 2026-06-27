"""
珠宝 CAD 多视图合一图切分（OpenCV 连通域）
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# 过滤参数（相对整图面积）
MIN_AREA_RATIO = 0.004
MAX_AREA_RATIO = 0.38
MIN_SIDE_PX = 48
PADDING_PX = 10


@dataclass
class ViewCrop:
    id: str
    x: int
    y: int
    width: int
    height: int
    guess: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _border_median_gray(gray: np.ndarray) -> float:
    h, w = gray.shape
    strip = max(2, min(h, w) // 40)
    parts = [
        gray[:strip, :].ravel(),
        gray[-strip:, :].ravel(),
        gray[:, :strip].ravel(),
        gray[:, -strip:].ravel(),
    ]
    return float(np.median(np.concatenate(parts)))


def _build_foreground_mask(rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    bg = _border_median_gray(gray)
    h, w = gray.shape
    img_area = h * w

    if bg >= 100:
        _, mask = cv2.threshold(
            gray, max(int(bg - 18), 0), 255, cv2.THRESH_BINARY_INV
        )
    else:
        _, mask = cv2.threshold(
            gray, min(int(bg + 22), 255), 255, cv2.THRESH_BINARY
        )

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1]
    value = hsv[:, :, 2]
    color_mask = ((sat > 28) & (value > 35)).astype(np.uint8) * 255
    mask = cv2.bitwise_or(mask, color_mask)

    k = max(3, int(min(h, w) * 0.008) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # 去掉贴边的大块（通常是背景噪点）
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cleaned = np.zeros_like(mask)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * MIN_AREA_RATIO:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if x <= 2 and y <= 2 and bw >= w * 0.92 and bh >= h * 0.92:
            continue
        cv2.drawContours(cleaned, [cnt], -1, 255, -1)
    return cleaned if cleaned.any() else mask


def _iou(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _merge_boxes(boxes: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    merged = list(boxes)
    changed = True
    while changed:
        changed = False
        out: List[Tuple[int, int, int, int]] = []
        used = [False] * len(merged)
        for i, a in enumerate(merged):
            if used[i]:
                continue
            ax, ay, aw, ah = a
            for j in range(i + 1, len(merged)):
                if used[j]:
                    continue
                if _iou(a, merged[j]) > 0.35:
                    bx, by, bw, bh = merged[j]
                    nx = min(ax, bx)
                    ny = min(ay, by)
                    nw = max(ax + aw, bx + bw) - nx
                    nh = max(ay + ah, by + bh) - ny
                    a = (nx, ny, nw, nh)
                    used[j] = True
                    changed = True
            out.append(a)
            used[i] = True
        merged = out
    return merged


def _guess_view_face(x: int, y: int, w: int, h: int, img_w: int, img_h: int) -> Optional[str]:
    """根据布局启发式猜测视角（仅供参考，用户可改）"""
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    aspect = w / max(h, 1)

    if cy < 0.42 and aspect > 0.65:
        return "top"
    if cy > 0.52 and 0.30 <= cx <= 0.68 and aspect > 0.55:
        return "front"
    if cy > 0.48 and cx >= 0.58:
        return "right"
    if cy > 0.48 and cx <= 0.28:
        return "left"
    if cy < 0.55 and cx >= 0.55 and aspect < 1.35:
        return None  # 常见透视区，不自动映射
    return None


def split_multi_view_sheet(image: Image.Image) -> Tuple[List[ViewCrop], List[Image.Image]]:
    """
    从合一 CAD 图切分出多个视图区域。

    Returns:
        crops 元数据列表, 对应 PIL 裁剪图（RGBA）
    """
    rgba = image.convert("RGBA")
    rgb = np.array(rgba.convert("RGB"))
    img_h, img_w = rgb.shape[:2]
    img_area = img_h * img_w

    mask = _build_foreground_mask(rgb)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes: List[Tuple[int, int, int, int]] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * MIN_AREA_RATIO or area > img_area * MAX_AREA_RATIO:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw < MIN_SIDE_PX or bh < MIN_SIDE_PX:
            continue
        boxes.append((x, y, bw, bh))

    boxes = _merge_boxes(boxes)
    if not boxes:
        raise ValueError("未检测到独立的视图区域，请确认上传的是多视图合一 CAD 图")

    boxes.sort(key=lambda b: (b[1] + b[3] / 2, b[0] + b[2] / 2))

    crops_meta: List[ViewCrop] = []
    crop_images: List[Image.Image] = []

    for idx, (x, y, bw, bh) in enumerate(boxes):
        x0 = max(0, x - PADDING_PX)
        y0 = max(0, y - PADDING_PX)
        x1 = min(img_w, x + bw + PADDING_PX)
        y1 = min(img_h, y + bh + PADDING_PX)
        cw, ch = x1 - x0, y1 - y0
        guess = _guess_view_face(x0, y0, cw, ch, img_w, img_h)
        crop_id = f"crop_{idx}"
        crops_meta.append(
            ViewCrop(id=crop_id, x=x0, y=y0, width=cw, height=ch, guess=guess)
        )
        crop_images.append(rgba.crop((x0, y0, x1, y1)))

    logger.info("CAD 切分完成: %d 个视图区域", len(crops_meta))
    return crops_meta, crop_images
