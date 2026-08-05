"""
珠宝 CAD 多视图合一图切分（OpenCV 连通域 + 投影分隔 fallback）
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
MIN_AREA_RATIO = 0.002
MAX_AREA_RATIO = 0.42
MIN_SIDE_PX = 32
PADDING_PX = 10
MAX_CROPS = 12


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


def _composite_rgb(image: Image.Image) -> np.ndarray:
    """Flatten RGBA onto white so transparent CAD exports still binarize."""
    rgba = image.convert("RGBA")
    bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    bg.paste(rgba, mask=rgba.split()[3])
    return np.array(bg.convert("RGB"))


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


def _build_foreground_mask_adaptive(rgb: np.ndarray) -> np.ndarray:
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

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    if float(np.mean(gray)) > 140:
        otsu = cv2.bitwise_not(otsu)
    mask = cv2.bitwise_or(mask, otsu)

    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1]
    value = hsv[:, :, 2]
    color_mask = ((sat > 24) & (value > 30)).astype(np.uint8) * 255
    mask = cv2.bitwise_or(mask, color_mask)

    k = max(3, int(min(h, w) * 0.006) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cleaned = np.zeros_like(mask)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * MIN_AREA_RATIO:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if x <= 2 and y <= 2 and bw >= w * 0.96 and bh >= h * 0.96:
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


def _filter_boxes(
    boxes: List[Tuple[int, int, int, int]],
    img_w: int,
    img_h: int,
) -> List[Tuple[int, int, int, int]]:
    img_area = img_w * img_h
    kept: List[Tuple[int, int, int, int]] = []
    for x, y, bw, bh in boxes:
        area = bw * bh
        if area < img_area * MIN_AREA_RATIO or area > img_area * MAX_AREA_RATIO:
            continue
        if bw < MIN_SIDE_PX or bh < MIN_SIDE_PX:
            continue
        if x + bw <= 2 or y + bh <= 2:
            continue
        if x >= img_w - 2 or y >= img_h - 2:
            continue
        kept.append((x, y, bw, bh))
    return kept


def _boxes_from_contours(
    mask: np.ndarray,
    img_w: int,
    img_h: int,
) -> List[Tuple[int, int, int, int]]:
    img_area = img_h * img_w
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: List[Tuple[int, int, int, int]] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * MIN_AREA_RATIO:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if area > img_area * MAX_AREA_RATIO:
            sub = mask[y : y + bh, x : x + bw]
            boxes.extend(_boxes_from_projection(sub, x, y, bw, bh))
            continue
        boxes.append((x, y, bw, bh))
    return _filter_boxes(boxes, img_w, img_h)


def _smooth_projection(proj: np.ndarray, ksize: int) -> np.ndarray:
    k = max(3, ksize | 1)
    return cv2.GaussianBlur(proj.astype(np.float32), (k, 1), 0).ravel()


def _find_gutter_cuts(proj: np.ndarray, length: int) -> List[int]:
    if length < MIN_SIDE_PX * 2:
        return [0, length]
    k = max(5, length // 48 | 1)
    smooth = _smooth_projection(proj, k)
    peak = float(smooth.max()) if len(smooth) else 0.0
    if peak <= 1e-6:
        return [0, length]
    rel = smooth / peak
    low = rel < 0.07
    min_run = max(6, length // 80)
    margin = max(MIN_SIDE_PX, length // 16)

    cuts = [0]
    i = margin
    while i < length - margin:
        if not low[i]:
            i += 1
            continue
        j = i
        while j < length and low[j]:
            j += 1
        if j - i >= min_run:
            cuts.append(int((i + j) // 2))
            i = j
        else:
            i += 1
    cuts.append(length)
    out: List[int] = []
    for c in cuts:
        if not out or c - out[-1] >= MIN_SIDE_PX:
            out.append(int(np.clip(c, 0, length)))
    if out[-1] != length:
        out.append(length)
    return out if len(out) >= 2 else [0, length]


def _boxes_from_projection(
    mask: np.ndarray,
    offset_x: int,
    offset_y: int,
    region_w: Optional[int] = None,
    region_h: Optional[int] = None,
) -> List[Tuple[int, int, int, int]]:
    h, w = mask.shape[:2]
    if region_w is None:
        region_w = w
    if region_h is None:
        region_h = h
    ink = (mask > 0).astype(np.uint8)
    row_sum = ink.sum(axis=1).astype(np.float32)
    col_sum = ink.sum(axis=0).astype(np.float32)
    row_cuts = _find_gutter_cuts(row_sum, h)
    col_cuts = _find_gutter_cuts(col_sum, w)

    boxes: List[Tuple[int, int, int, int]] = []
    for ri in range(len(row_cuts) - 1):
        y0, y1 = row_cuts[ri], row_cuts[ri + 1]
        if y1 - y0 < MIN_SIDE_PX:
            continue
        for ci in range(len(col_cuts) - 1):
            x0, x1 = col_cuts[ci], col_cuts[ci + 1]
            if x1 - x0 < MIN_SIDE_PX:
                continue
            patch = ink[y0:y1, x0:x1]
            if int(patch.sum()) < max(24, patch.size * 0.008):
                continue
            boxes.append((offset_x + x0, offset_y + y0, x1 - x0, y1 - y0))
    return _filter_boxes(boxes, region_w, region_h)


def _dedupe_boxes(
    boxes: List[Tuple[int, int, int, int]],
) -> List[Tuple[int, int, int, int]]:
    if len(boxes) <= 1:
        return boxes
    out: List[Tuple[int, int, int, int]] = []
    for box in sorted(boxes, key=lambda b: b[2] * b[3], reverse=True):
        if all(_iou(box, kept) < 0.72 for kept in out):
            out.append(box)
        if len(out) >= MAX_CROPS:
            break
    return out


def _detect_view_boxes(rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
    img_h, img_w = rgb.shape[:2]
    mask = _build_foreground_mask_adaptive(rgb)

    boxes = _boxes_from_contours(mask, img_w, img_h)
    if len(boxes) < 2:
        boxes.extend(_boxes_from_projection(mask, 0, 0, img_w, img_h))

    boxes = _merge_boxes(boxes)
    boxes = _filter_boxes(boxes, img_w, img_h)
    boxes = _dedupe_boxes(boxes)

    if len(boxes) == 1:
        x, y, bw, bh = boxes[0]
        sub = mask[y : y + bh, x : x + bw]
        projected = _boxes_from_projection(sub, x, y, img_w, img_h)
        if len(projected) >= 2:
            boxes = projected

    if len(boxes) < 2:
        for grid in ((2, 2), (1, 3), (3, 1), (2, 3), (3, 2)):
            rows, cols = grid
            gw = img_w // cols
            gh = img_h // rows
            grid_boxes: List[Tuple[int, int, int, int]] = []
            for r in range(rows):
                for c in range(cols):
                    x0 = c * gw
                    y0 = r * gh
                    x1 = img_w if c == cols - 1 else (c + 1) * gw
                    y1 = img_h if r == rows - 1 else (r + 1) * gh
                    patch = mask[y0:y1, x0:x1]
                    if int((patch > 0).sum()) >= max(32, patch.size * 0.01):
                        grid_boxes.append((x0, y0, x1 - x0, y1 - y0))
            grid_boxes = _filter_boxes(grid_boxes, img_w, img_h)
            if len(grid_boxes) >= 2:
                boxes = grid_boxes
                logger.info("CAD 切分使用网格 fallback: %dx%d -> %d 块", rows, cols, len(boxes))
                break

    return boxes


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
        return None
    return None


def split_multi_view_sheet(image: Image.Image) -> Tuple[List[ViewCrop], List[Image.Image]]:
    """
    从合一 CAD 图切分出多个视图区域。

    Returns:
        crops 元数据列表, 对应 PIL 裁剪图（RGBA）
    """
    rgba = image.convert("RGBA")
    rgb = _composite_rgb(rgba)
    img_h, img_w = rgb.shape[:2]

    boxes = _detect_view_boxes(rgb)
    if len(boxes) < 2:
        raise ValueError(
            "未检测到独立的视图区域，请确认上传的是多视图合一 CAD 图；"
            "也可切换到「手动框选」模式自行划分视角"
        )

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
