"""
背景扣除预处理（rembg / u2net）
"""

import logging
from typing import Any, Dict, Optional

from PIL import Image

from app.services.preprocess.base import PreprocessStep
from app.services.preprocess.types import PreprocessStepType

logger = logging.getLogger(__name__)

_rembg_session = None


def _get_rembg_session():
    """延迟加载 rembg 会话，避免拖慢服务启动"""
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        logger.info("初始化 rembg u2net 会话...")
        _rembg_session = new_session("u2net")
    return _rembg_session


class RemoveBackgroundStep(PreprocessStep):
    """使用 rembg 扣除背景，输出 RGBA 透明底 PNG"""

    step_type = PreprocessStepType.REMOVE_BACKGROUND

    def process(self, image: Image.Image, **kwargs) -> Dict[str, Any]:
        from rembg import remove

        rgba = image.convert("RGBA")
        session: Optional[Any] = kwargs.get("session")
        if session is None:
            session = _get_rembg_session()

        logger.info("执行背景扣除...")
        result = remove(rgba, session=session)
        if not isinstance(result, Image.Image):
            result = Image.fromarray(result)

        result = result.convert("RGBA")
        return {"processed_image": result}
