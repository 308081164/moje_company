"""
Hunyuan3D-Omni 点云条件生成封装。
Omni 权重或 hy3dshape 不可用时自动回退 image-only。
"""

from __future__ import annotations

import logging
import math
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np

from app.config import GenerationConfig, OmniConfig, get_config, resolve_mc_algo

logger = logging.getLogger(__name__)


class OmniConditionalGenerator:
    """Image + point cloud conditioning via Hunyuan3D-Omni."""

    def __init__(self, model_manager):
        self._model_manager = model_manager
        self._last_error: Optional[str] = None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def is_enabled(self) -> bool:
        cfg = get_config().omni
        return bool(cfg.enabled)

    def try_load(self) -> bool:
        if not self.is_enabled():
            self._last_error = "omni_disabled"
            return False
        pipeline = self._model_manager.load_omni_pipeline()
        if pipeline is None:
            self._last_error = self._model_manager.get_last_omni_error() or "omni_unavailable"
            return False
        self._last_error = None
        return True

    @staticmethod
    def _build_gen_kwargs(gen_cfg: GenerationConfig) -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {
            "num_inference_steps": gen_cfg.num_inference_steps,
            "guidance_scale": gen_cfg.guidance_scale,
            "octree_resolution": gen_cfg.octree_resolution,
            "mc_level": gen_cfg.mc_level,
        }
        resolved_mc = resolve_mc_algo(gen_cfg.mc_algo)
        if resolved_mc:
            kwargs["mc_algo"] = resolved_mc
        return kwargs

    @staticmethod
    def _extract_mesh(result: Any):
        if result is None:
            return None
        if hasattr(result, "vertices") and hasattr(result, "faces"):
            return result
        if isinstance(result, dict):
            shapes = result.get("shapes")
            if shapes and len(shapes) > 0 and len(shapes[0]) > 0:
                return shapes[0][0]
        if isinstance(result, (list, tuple)) and result:
            first = result[0]
            if hasattr(first, "vertices"):
                return first
        return None

    def generate(
        self,
        image_path: str,
        condition_features: Dict[str, Any],
        gen_cfg: GenerationConfig,
        *,
        prompt: str = "",
    ) -> Tuple[Optional[Any], Dict[str, Any]]:
        """
        Run Omni point-conditioned generation.

        Returns:
            (mesh_or_none, metadata)
        """
        meta: Dict[str, Any] = {"condition_mode": "image_only"}
        if not self.try_load():
            meta["omni_fallback_reason"] = self._last_error
            logger.warning("Omni 回退 image-only: %s", self._last_error)
            return None, meta

        pipeline = self._model_manager.get_model("omni")
        if pipeline is None:
            meta["omni_fallback_reason"] = "pipeline_not_loaded"
            logger.warning("Omni 回退 image-only: pipeline 未加载")
            return None, meta

        points = np.asarray(condition_features.get("normalized_points"), dtype=np.float32)
        if points.size == 0:
            points = np.asarray(condition_features.get("point_cloud"), dtype=np.float32)
        if points.size == 0:
            meta["omni_fallback_reason"] = "empty_point_cloud"
            logger.warning("Omni 跳过: 点云为空")
            return None, meta

        from app.services.pointcloud_conditioner import build_omni_condition_points

        cfg = get_config()
        omni_points, sel_info = build_omni_condition_points(
            condition_features,
            num_points=cfg.model.point_cloud_density,
        )
        meta["omni_point_selection"] = sel_info
        if omni_points.size == 0:
            meta["omni_fallback_reason"] = "empty_point_cloud"
            logger.warning("Omni 跳过: 条件点选择为空")
            return None, meta

        try:
            import torch

            device = getattr(pipeline, "device", "cuda")
            dtype = getattr(pipeline, "dtype", torch.float16)
            surface = torch.as_tensor(omni_points, dtype=dtype, device=device).unsqueeze(0)

            kwargs = self._build_gen_kwargs(gen_cfg)
            logger.info(
                "Omni 点云条件生成: points=%d (mode=%s) steps=%d octree=%d",
                len(omni_points),
                sel_info.get("mode", "?"),
                kwargs.get("num_inference_steps"),
                kwargs.get("octree_resolution"),
            )
            result = pipeline(
                image=image_path,
                point=surface,
                **kwargs,
            )
            mesh = self._extract_mesh(result)
            if mesh is None:
                meta["omni_fallback_reason"] = "empty_mesh"
                logger.warning("Omni 回退: 输出网格为空")
                return None, meta

            inv = condition_features.get("inverse_transform")
            if inv:
                from app.services.pointcloud_conditioner import apply_inverse_transform_to_mesh

                mesh = apply_inverse_transform_to_mesh(mesh, inv)
                meta["inverse_transform_applied"] = True

            meta["condition_mode"] = "omni"
            meta["omni_point_count"] = int(len(omni_points))
            if inv:
                meta["omni_inverse_transform"] = inv
            if prompt:
                meta["omni_prompt_aux"] = prompt[:200]
            return mesh, meta
        except Exception as e:
            self._last_error = str(e)
            logger.warning("Omni 条件生成失败，回退 image-only: %s", e)
            meta["omni_fallback_reason"] = str(e)
            return None, meta


def estimate_dynamic_box_v(
    condition_features: Optional[Dict[str, Any]],
    stone_diameter_mm: Optional[float],
    default_box_v: float = 1.01,
) -> float:
    """Estimate ShapeGen box_v from inlay bbox / stone diameter."""
    if not condition_features:
        return default_box_v
    bbox = condition_features.get("bbox")
    if not bbox or len(bbox) < 3:
        return default_box_v
    diag = math.sqrt(sum(float(x) ** 2 for x in bbox[:3]))
    ref = float(stone_diameter_mm) if stone_diameter_mm else max(diag * 0.5, 1.0)
    if ref <= 0:
        return default_box_v
    ratio = diag / ref
    return float(np.clip(ratio, 0.85, 1.35))


def resolve_omni_model_dir(omni_cfg: OmniConfig) -> Optional[str]:
    """Return local Omni weights directory if present."""
    base = Path(omni_cfg.model_path).expanduser()
    if base.is_dir() and any(base.rglob("config.yaml")):
        return str(base.resolve())
    parent = Path(get_config().model.model_path)
    for sub in ("hunyuan3d-omni", "Hunyuan3D-Omni"):
        cand = parent / sub
        if cand.is_dir():
            return str(cand.resolve())
    return None


def verify_omni_pipeline_api() -> Dict[str, Any]:
    """
    Spike helper: report Omni import/pipeline availability without loading weights.
    """
    report: Dict[str, Any] = {
        "hy3dshape_available": False,
        "pipeline_class": None,
        "local_model_dir": None,
        "repo_id": get_config().omni.repo_id,
    }
    try:
        from hy3dshape.pipelines import Hunyuan3DOmniSiTFlowMatchingPipeline  # noqa: F401

        report["hy3dshape_available"] = True
        report["pipeline_class"] = "Hunyuan3DOmniSiTFlowMatchingPipeline"
    except ImportError as e:
        report["import_error"] = str(e)
    report["local_model_dir"] = resolve_omni_model_dir(get_config().omni)
    return report
