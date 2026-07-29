"""
SAM2 / SAM 点选宝石分割（延迟加载模型，优先 SAM2，回退 SAM1 vit_b）。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image

from app.config import get_config

logger = logging.getLogger(__name__)

Point = Tuple[float, float, int]  # x, y, label (1=前景宝石, 0=背景)


@dataclass
class SamGemSegmentResult:
    mask: np.ndarray
    coverage_ratio: float
    engine: str


_predictor = None
_predictor_engine: Optional[str] = None


def _models_dir() -> Path:
    config = get_config()
    candidates = [
        Path(config.model.model_path),
        Path(__file__).resolve().parents[4] / "models",
        Path(__file__).resolve().parents[3] / "models",
    ]
    for base in candidates:
        if base.is_dir() and (base / "sam").is_dir() or (base / "sam2").is_dir():
            return base
        if base.is_dir():
            return base
    return candidates[0]


def _resolve_sam2_paths() -> Optional[Tuple[str, str]]:
    root = _models_dir() / "sam2"
    ckpt_candidates = [
        root / "sam2.1_hiera_tiny.pt",
        root / "sam2_hiera_tiny.pt",
    ]
    cfg_candidates: List[Path] = []
    try:
        import sam2

        pkg = Path(sam2.__file__).resolve().parent
        cfg_candidates.extend(
            [
                pkg / "configs" / "sam2.1" / "sam2.1_hiera_t.yaml",
                pkg / "configs" / "sam2" / "sam2_hiera_t.yaml",
            ]
        )
    except ImportError:
        pass
    cfg_candidates.extend(
        [
            root / "configs" / "sam2.1" / "sam2.1_hiera_t.yaml",
            root / "configs" / "sam2" / "sam2_hiera_t.yaml",
        ]
    )

    for ckpt in ckpt_candidates:
        if not ckpt.is_file():
            continue
        for cfg in cfg_candidates:
            if cfg.is_file():
                return str(cfg), str(ckpt)
    return None


def _resolve_sam1_checkpoint() -> Optional[str]:
    ckpt = _models_dir() / "sam" / "sam_vit_b_01ec64.pth"
    return str(ckpt) if ckpt.is_file() else None


def _load_sam2_predictor():
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    paths = _resolve_sam2_paths()
    if paths is None:
        raise FileNotFoundError("SAM2 权重或配置文件缺失")

    cfg_path, ckpt_path = paths
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_sam2(cfg_path, ckpt_path, device=device)
    predictor = SAM2ImagePredictor(model)
    logger.info("SAM2 点选分割已加载: %s (device=%s)", ckpt_path, device)
    return predictor, "sam2"


def _load_sam1_predictor():
    from segment_anything import SamPredictor, sam_model_registry
    import torch

    ckpt = _resolve_sam1_checkpoint()
    if ckpt is None:
        raise FileNotFoundError("SAM vit_b 权重缺失")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = sam_model_registry["vit_b"](checkpoint=ckpt)
    model.to(device=device)
    predictor = SamPredictor(model)
    logger.info("SAM1 vit_b 点选分割已加载: %s (device=%s)", ckpt, device)
    return predictor, "sam1"


def get_sam_predictor():
    """单例加载 SAM2（优先）或 SAM1。"""
    global _predictor, _predictor_engine
    if _predictor is not None:
        return _predictor, _predictor_engine

    try:
        _predictor, _predictor_engine = _load_sam2_predictor()
        return _predictor, _predictor_engine
    except Exception as e:
        logger.warning("SAM2 不可用 (%s)，尝试 SAM1 vit_b", e)

    _predictor, _predictor_engine = _load_sam1_predictor()
    return _predictor, _predictor_engine


def _foreground_mask_from_rgba(rgba: np.ndarray) -> np.ndarray:
    if rgba.shape[2] == 4:
        return rgba[:, :, 3] > 12
    gray = np.mean(rgba[:, :, :3], axis=2)
    return gray < 250


def _parse_points(points: Sequence[dict]) -> List[Point]:
    parsed: List[Point] = []
    for item in points:
        if not isinstance(item, dict):
            continue
        x = float(item.get("x", 0))
        y = float(item.get("y", 0))
        label = int(item.get("label", 1))
        parsed.append((x, y, 1 if label != 0 else 0))
    if not parsed:
        raise ValueError("请至少提供一个点选坐标")
    if not any(p[2] == 1 for p in parsed):
        raise ValueError("请至少包含一个前景点（宝石）")
    return parsed


def segment_gem_with_points(
    image: Image.Image,
    points: Sequence[dict],
) -> SamGemSegmentResult:
    """
    根据点选坐标分割宝石区域。

    points: [{"x": 120, "y": 340, "label": 1}, ...]  label 1=宝石 0=排除
    """
    predictor, engine = get_sam_predictor()
    rgba = np.array(image.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[:, :, :3]

    parsed = _parse_points(points)
    coords = np.array([[p[0], p[1]] for p in parsed], dtype=np.float32)
    labels = np.array([p[2] for p in parsed], dtype=np.int32)

    predictor.set_image(rgb)
    masks, scores, _ = predictor.predict(
        point_coords=coords,
        point_labels=labels,
        multimask_output=True,
    )

    if masks.ndim == 3:
        best_idx = int(np.argmax(scores))
        mask = masks[best_idx].astype(bool)
    else:
        mask = masks.astype(bool)

    fg = _foreground_mask_from_rgba(rgba)
    mask &= fg

    kernel = np.ones((3, 3), np.uint8)
    mask_u8 = (mask.astype(np.uint8) * 255)
    mask_u8 = cv2_morph_close_open(mask_u8)
    mask = mask_u8 > 0

    fg_pixels = max(int(fg.sum()), 1)
    coverage = float(mask.sum()) / fg_pixels

    logger.info(
        "SAM 点选分割完成: engine=%s points=%d coverage=%.2f%% score=%.3f",
        engine,
        len(parsed),
        coverage * 100,
        float(scores.max()) if len(scores) else 0.0,
    )
    return SamGemSegmentResult(mask=mask, coverage_ratio=coverage, engine=engine)


def cv2_morph_close_open(mask_u8: np.ndarray) -> np.ndarray:
    import cv2

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask_u8 = cv2.morphologyEx(mask_u8, cv2.MORPH_OPEN, kernel, iterations=1)
    return mask_u8


def sam_model_available() -> bool:
    """检查本地是否已有 SAM2 或 SAM1 权重。"""
    if _resolve_sam2_paths() is not None:
        return True
    return _resolve_sam1_checkpoint() is not None


def sam_model_hint() -> str:
    models = _models_dir()
    return (
        f"请下载 SAM 权重至 {models}/sam2/ 或 {models}/sam/ ，"
        f"并运行 scripts/download-sam-model.ps1"
    )
