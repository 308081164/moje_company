"""
预处理步骤基类
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from PIL import Image

from app.services.preprocess.types import PreprocessStepType


class PreprocessStep(ABC):
    """可插拔预处理步骤接口"""

    step_type: PreprocessStepType

    @abstractmethod
    def process(self, image: Image.Image, **kwargs) -> Dict[str, Any]:
        """
        执行预处理

        Returns:
            至少包含 processed_image (PIL.Image)
        """
