"""
预处理步骤类型定义
"""

from enum import Enum


class PreprocessStepType(str, Enum):
    """可插拔预处理步骤（后续可扩展多视角生成等）"""
    REMOVE_BACKGROUND = "remove_background"
    MULTI_VIEW = "multi_view"  # 预留：生成多视角图像
