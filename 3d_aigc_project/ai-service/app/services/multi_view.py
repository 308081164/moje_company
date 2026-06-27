"""
多视图方位常量与 hy3dgen 映射
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# 六视图标准键
VIEW_FACES: List[str] = ["front", "back", "left", "right", "top", "bottom"]

# hy3dgen MVImageProcessorV2 支持的视角（水平四向）
HY3D_MV_FACES: List[str] = ["front", "left", "back", "right"]

# 多视图 ShapeGen 子目录名（Hunyuan3D-2mv 仓库内）
MV_SHAPE_SUBDIRS: List[str] = [
    "hunyuan3d-dit-v2-mv",
    "hunyuan3d-dit-v2-mv-turbo",
]
MV_REPO_DIR = "hunyuan3d-2mv"

# 单视图 ShapeGen 子目录名（按优先级：标准 > turbo > mini）
SINGLE_SHAPE_SUBDIRS: List[str] = [
    "hunyuan3d-dit-v2-0",
    "hunyuan3d-dit-v2-0-turbo",
    "hunyuan3d-dit-v2-mini",
    "hunyuan3d-dit-v2-mini-turbo",
    "hunyuan3d-dit-v2-mini-fast",
]
SINGLE_REPO_DIRS: List[str] = [
    "hunyuan3d-2",
    "hunyuan3d-2-turbo",
    "hunyuan3d-2mini",
]

VIEW_LABELS_ZH: Dict[str, str] = {
    "front": "正视图",
    "back": "后视图",
    "left": "左视图",
    "right": "右视图",
    "top": "俯视图",
    "bottom": "仰视图",
}


def filter_views_for_hy3d(views: Dict[str, str]) -> Dict[str, str]:
    """提取 hy3dgen 可识别的水平四向视角"""
    return {k: v for k, v in views.items() if k in HY3D_MV_FACES and v}


def unsupported_view_keys(views: Dict[str, str]) -> List[str]:
    """返回已上传但 hy3dgen 暂不支持的视角键"""
    return [k for k in views if k not in HY3D_MV_FACES]


def pick_texture_image_path(
    views: Optional[Dict[str, str]], fallback: str
) -> str:
    """纹理生成优先使用正视图"""
    if views:
        for key in ("front", "left", "right", "back"):
            if key in views:
                return views[key]
    return fallback


def pick_best_single_view_path(views: Dict[str, str]) -> Optional[str]:
    """单图回退时优先正视图，其次其他已上传视角"""
    for key in ("front", "left", "right", "back", "top", "bottom"):
        path = views.get(key)
        if path:
            return path
    return None


def config_yaml_supports_multi_view(config_path: Path) -> bool:
    """从 config.yaml 判断是否配置 MVImageProcessorV2"""
    try:
        text = config_path.read_text(encoding="utf-8")
    except OSError:
        return False
    return "MVImageProcessorV2" in text


def find_local_mv_shape_path(model_base_path: str) -> Optional[str]:
    """
    在本地 models 目录中查找 hunyuan3d-dit-v2-mv 权重目录。
    支持 models/hunyuan3d-2mv/... 与 models/... 两种布局。
    """
    base = Path(model_base_path)
    search_roots = [
        base / MV_REPO_DIR,
        base / "hunyuan3d-2" / MV_REPO_DIR,
        base,
    ]
    for root in search_roots:
        if not root.is_dir():
            continue
        for sub in MV_SHAPE_SUBDIRS:
            cand = root / sub
            cfg = cand / "config.yaml"
            if (
                cfg.is_file()
                and config_yaml_supports_multi_view(cfg)
                and shape_dir_has_weights(cand)
            ):
                return str(cand.resolve())
    return None


def shape_dir_has_weights(shape_dir: Path) -> bool:
    """ShapeGen 目录是否包含可加载的权重文件"""
    return (
        (shape_dir / "model.fp16.safetensors").is_file()
        or (shape_dir / "model.fp16.ckpt").is_file()
    )


def find_local_single_view_shape_path(model_base_path: str) -> Optional[str]:
    """
    在本地 models 目录中查找单图 ShapeGen 权重目录（非 MVImageProcessorV2）。
    """
    base = Path(model_base_path)
    search_roots: List[Path] = [base]
    for repo in SINGLE_REPO_DIRS:
        search_roots.append(base / repo)
    seen: set = set()
    for root in search_roots:
        root = root.resolve()
        if not root.is_dir() or root in seen:
            continue
        seen.add(root)
        for sub in SINGLE_SHAPE_SUBDIRS:
            cand = root / sub
            cfg = cand / "config.yaml"
            if (
                cfg.is_file()
                and not config_yaml_supports_multi_view(cfg)
                and shape_dir_has_weights(cand)
            ):
                return str(cand.resolve())
    return None


def pipeline_supports_multi_view(shape_gen: Any) -> bool:
    """检测已加载 pipeline 是否支持多视图 dict 输入"""
    if shape_gen is None:
        return False

    processor = getattr(shape_gen, "image_processor", None)
    if processor is not None:
        if type(processor).__name__ == "MVImageProcessorV2":
            return True
        if getattr(processor, "return_view_idx", False):
            return True

    for attr in ("config", "_config", "model_config"):
        cfg = getattr(shape_gen, attr, None)
        if cfg is None:
            continue
        try:
            ip_cfg = cfg.get("image_processor", {}) if isinstance(cfg, dict) else {}
            target = ip_cfg.get("target", "")
            if "MVImageProcessorV2" in str(target):
                return True
        except Exception:
            pass

    return False


def multi_view_unavailable_message(fallback_failed: bool = False) -> str:
    """返回面向用户的中文错误说明"""
    if fallback_failed:
        return (
            "多视图生成不可用：当前模型不支持多视图，且无法使用任一视角进行单图回退。"
            "请检查上传的图片是否有效，或下载 Hunyuan3D-2mv 模型后设置 MODEL_VERSION=mv。"
        )
    return (
        "多视图生成需要 Hunyuan3D-2mv 模型（含 MVImageProcessorV2）。"
        "当前仅加载了单图模型；请下载多视图模型至 models/hunyuan3d-2mv/ 并设置 MODEL_VERSION=mv，"
        "或使用单图模式（仅上传正视图）。"
    )


def single_view_unavailable_message() -> str:
    """单图 pipeline 不可用时的错误说明"""
    return (
        "单图生成不可用：未加载 ShapeGen 模型，或无法切换至单图权重。"
        "请确认 models/ 下存在 hunyuan3d-2mv 或 hunyuan3d-2mini 权重，"
        "并检查 MODEL_PATH 环境变量。"
    )
