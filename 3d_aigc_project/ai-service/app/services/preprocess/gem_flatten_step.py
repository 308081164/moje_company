"""宝石占位色预处理步骤（可插拔）"""

from typing import Any, Dict

from PIL import Image

from app.services.preprocess.base import PreprocessStep
from app.services.preprocess.gem_flatten import flatten_gem_regions
from app.services.preprocess.types import PreprocessStepType


class GemFlattenStep(PreprocessStep):
    step_type = PreprocessStepType.GEM_FLATTEN

    def process(self, image: Image.Image, **kwargs) -> Dict[str, Any]:
        preset = kwargs.get("gem_preset", "ruby")
        custom_color = kwargs.get("custom_color")
        sensitivity = float(kwargs.get("sensitivity", 0.55))
        preserve_edges = bool(kwargs.get("preserve_edges", True))

        result = flatten_gem_regions(
            image,
            preset=preset,
            custom_color=custom_color,
            sensitivity=sensitivity,
            preserve_edges=preserve_edges,
        )
        return {
            "processed_image": result.image,
            "gem_coverage_ratio": result.coverage_ratio,
            "gem_preset": result.preset,
            "segment_method": result.method,
        }
