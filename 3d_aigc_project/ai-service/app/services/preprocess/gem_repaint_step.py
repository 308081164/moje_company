"""宝石去反光 AI 重绘预处理步骤"""

from typing import Any, Dict

from PIL import Image

from app.services.preprocess.base import PreprocessStep
from app.services.preprocess.gem_repaint import repaint_gem_with_mask
from app.services.preprocess.types import PreprocessStepType


class GemRepaintStep(PreprocessStep):
    step_type = PreprocessStepType.GEM_REPAINT

    def process(self, image: Image.Image, **kwargs) -> Dict[str, Any]:
        mask = kwargs.get("mask")
        if mask is None:
            raise ValueError("GemRepaintStep 需要 mask 参数")

        result = repaint_gem_with_mask(
            image,
            mask,
            prompt=kwargs.get("prompt"),
            strength=float(kwargs.get("strength", 0.45)),
            preserve_edges=bool(kwargs.get("preserve_edges", True)),
            mask_dilate_px=int(kwargs.get("mask_dilate_px", 8)),
            seed=kwargs.get("seed"),
            segment_method=str(kwargs.get("segment_method", "sam2")),
        )
        return {
            "processed_image": result.image,
            "gem_coverage_ratio": result.coverage_ratio,
            "segment_method": result.segment_method,
            "repaint_method": result.repaint_method,
        }
