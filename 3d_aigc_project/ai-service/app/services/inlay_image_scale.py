"""
Calibrate multi-view images using inlay bbox / stone diameter hints.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

TARGET_SUBJECT_FILL = 0.42


def _alpha_bbox(img: Image.Image) -> Optional[Tuple[int, int, int, int]]:
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba)
    if arr.shape[2] < 4:
        return None
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def _expected_subject_px(
    img_w: int,
    img_h: int,
    condition_features: Optional[Dict[str, Any]],
    stone_diameter_mm: Optional[float],
) -> float:
    base = float(min(img_w, img_h)) * TARGET_SUBJECT_FILL
    if not condition_features:
        return base
    bbox = condition_features.get("bbox")
    stone = float(stone_diameter_mm) if stone_diameter_mm else None
    if bbox and len(bbox) >= 3 and stone and stone > 0:
        inlay_diag = float(np.sqrt(sum(float(x) ** 2 for x in bbox[:3])))
        if inlay_diag > 1e-6:
            # Heuristic: AI shank outer diameter ~ 2.2x stone for ring products
            target_mm = max(stone * 2.2, inlay_diag * 1.05)
            px_per_mm = base / max(stone * 1.8, 1.0)
            return float(np.clip(target_mm * px_per_mm, base * 0.75, base * 1.35))
    return base


def calibrate_view_image(
    image_path: str,
    output_path: str,
    *,
    condition_features: Optional[Dict[str, Any]] = None,
    stone_diameter_mm: Optional[float] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Scale+center subject so pixel extent matches inlay-derived target."""
    img = Image.open(image_path).convert("RGBA")
    bbox = _alpha_bbox(img)
    info: Dict[str, Any] = {"source": image_path, "scaled": False}
    if bbox is None:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        img.save(output_path)
        info["reason"] = "no_alpha_subject"
        return output_path, info

    x0, y0, x1, y1 = bbox
    sub_w = max(x1 - x0, 1)
    sub_h = max(y1 - y0, 1)
    sub_major = float(max(sub_w, sub_h))
    target_px = _expected_subject_px(img.width, img.height, condition_features, stone_diameter_mm)
    scale = float(np.clip(target_px / sub_major, 0.55, 1.85))
    if abs(scale - 1.0) < 0.06:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        img.save(output_path)
        info["reason"] = "within_tolerance"
        info["scale"] = 1.0
        return output_path, info

    new_w = max(int(round(img.width * scale)), 64)
    new_h = max(int(round(img.height * scale)), 64)
    scaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (img.width, img.height), (0, 0, 0, 0))
    ox = (img.width - new_w) // 2
    oy = (img.height - new_h) // 2
    canvas.paste(scaled, (ox, oy), scaled)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    canvas.save(output_path)
    info.update(
        {
            "scaled": True,
            "scale": scale,
            "target_px": target_px,
            "subject_px_before": sub_major,
            "output": output_path,
        }
    )
    return output_path, info


def calibrate_views_for_inlay(
    views: Dict[str, str],
    output_dir: str,
    task_id: str,
    *,
    condition_features: Optional[Dict[str, Any]] = None,
    stone_diameter_mm: Optional[float] = None,
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    from app.utils.file_utils import generate_output_path

    out_views: Dict[str, str] = {}
    per_view: Dict[str, Any] = {}
    for face, path in views.items():
        if not path or not os.path.isfile(path):
            continue
        out_path = generate_output_path(
            output_dir, task_id, f"scaled_{face}.png"
        )
        out_path, info = calibrate_view_image(
            path,
            out_path,
            condition_features=condition_features,
            stone_diameter_mm=stone_diameter_mm,
        )
        out_views[face] = out_path
        per_view[face] = info
    return out_views, {"per_view": per_view, "any_scaled": any(v.get("scaled") for v in per_view.values())}
