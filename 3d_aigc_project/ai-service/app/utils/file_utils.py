"""
文件处理工具模块
提供文件保存、格式转换、路径管理等工具函数
"""

import os
import struct
import uuid
import shutil
import logging
from pathlib import Path
from typing import Any, Dict, Optional, List, Union
from datetime import datetime

from PIL import Image

logger = logging.getLogger(__name__)

# 支持的3D模型格式
SUPPORTED_3D_FORMATS = {".glb", ".gltf", ".obj", ".stl", ".ply", ".fbx", ".off"}
# 支持的图像格式
SUPPORTED_IMAGE_FORMATS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}


def ensure_dir(path: str) -> str:
    """
    确保目录存在，不存在则创建
    """
    dir_path = Path(path)
    dir_path.mkdir(parents=True, exist_ok=True)
    return str(dir_path)


def generate_task_id() -> str:
    """
    生成唯一的任务ID
    格式: task_YYYYMMDD_HHMMSS_<uuid_short>
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_uuid = str(uuid.uuid4())[:8]
    return f"task_{timestamp}_{short_uuid}"


def generate_output_path(
    output_dir: str,
    task_id: str,
    filename: Optional[str] = None,
    extension: str = ".glb"
) -> str:
    """
    生成输出文件路径

    Args:
        output_dir: 输出根目录
        task_id: 任务ID
        filename: 指定文件名（可选）
        extension: 文件扩展名

    Returns:
        完整的输出文件路径
    """
    # 每个任务一个子目录
    task_dir = os.path.join(output_dir, task_id)
    ensure_dir(task_dir)

    if filename:
        filepath = os.path.join(task_dir, filename)
    else:
        # 自动生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = os.path.join(task_dir, f"result_{timestamp}{extension}")

    return filepath


def get_task_dir(output_dir: str, task_id: str) -> str:
    """
    获取任务输出目录路径
    """
    return os.path.join(output_dir, task_id)


def validate_file_exists(filepath: str) -> bool:
    """
    验证文件是否存在
    """
    return os.path.isfile(filepath)


def validate_file_format(filepath: str, allowed_formats: set) -> bool:
    """
    验证文件格式是否在允许的范围内
    """
    ext = Path(filepath).suffix.lower()
    return ext in allowed_formats


def load_image_pil(filepath: str, preserve_alpha: bool = False) -> Image.Image:
    """
    以 Unicode 安全方式加载图像（Windows 下 cv2.imread 无法读取中文路径）

    preserve_alpha=True 时保留 RGBA，供 Hunyuan3D ImageProcessorV2 使用 alpha 通道区分主体与背景。
    """
    with Image.open(filepath) as img:
        if preserve_alpha:
            return img.convert("RGBA")
        return img.convert("RGB")


def validate_image_file(filepath: str) -> bool:
    """
    验证是否为有效的图像文件
    """
    if not validate_file_exists(filepath):
        logger.error(f"图像文件不存在: {filepath}")
        return False
    if not validate_file_format(filepath, SUPPORTED_IMAGE_FORMATS):
        logger.error(f"不支持的图像格式: {filepath}")
        return False
    try:
        load_image_pil(filepath)
        return True
    except Exception as e:
        logger.error(f"图像文件无法解析: {filepath} ({e})")
        return False


def _looks_like_binary_stl(header: bytes, file_size: int) -> bool:
    """80 字节头 + uint32 面数 + 50 字节/三角面。"""
    if file_size < 84 or len(header) < 84:
        return False
    tri_count = struct.unpack_from("<I", header, 80)[0]
    if tri_count <= 0:
        return False
    return 84 + tri_count * 50 <= file_size


def _looks_like_json_error(header: bytes) -> bool:
    head = header.lstrip()
    if not head:
        return False
    if head[:1] not in (b"{", b"["):
        return False
    text = head[:512].decode("utf-8", errors="ignore").lower()
    if '"detail"' in text or '"error"' in text or '"message"' in text:
        return True
    return head[:1] == b"{" and b"asset" not in head[:512].lower()


def sniff_mesh_file_type(filepath: str) -> Optional[str]:
    """
    按文件头识别网格格式，避免 inlay_cache 中 GLB 被误存为 .obj 导致加载失败。
    返回 trimesh.load 可用的 file_type：glb/gltf/obj/stl/ply/off 等；无法识别时返回 None。

    注意：扩展名为 .glb 但缺少 glTF magic 时返回 None，禁止仅凭扩展名当作 GLB。
    """
    try:
        file_size = os.path.getsize(filepath)
    except OSError as e:
        logger.debug("无法 stat 网格文件 %s: %s", filepath, e)
        return None

    if file_size == 0:
        return None

    try:
        with open(filepath, "rb") as f:
            header = f.read(max(512, min(file_size, 65536)))
    except OSError as e:
        logger.debug("无法读取网格文件头 %s: %s", filepath, e)
        return None

    if len(header) >= 4 and header[:4] == b"glTF":
        return "glb"

    head = header.lstrip()
    if head.startswith(b"solid") or (len(head) >= 5 and head[:5] == b"solid"):
        return "stl"
    if _looks_like_binary_stl(header, file_size):
        return "stl"

    try:
        text_head = head[:256].decode("utf-8", errors="ignore").lstrip()
    except Exception:
        text_head = ""

    if text_head.startswith("v ") or text_head.startswith("#") or text_head.startswith("o "):
        return "obj"
    if text_head.startswith("ply") or text_head.startswith("comment"):
        return "ply"
    if text_head.startswith("OFF") or text_head.startswith("COOFF"):
        return "off"

    if head[:1] in (b"{", b"["):
        if b'"asset"' in head[:512].lower():
            return "gltf"
        if _looks_like_json_error(header):
            return None

    ext = Path(filepath).suffix.lower().lstrip(".")
    # .glb 必须匹配 magic；JSON/HTML 占位也不能回退为 glb
    if ext == "glb":
        return None
    if ext == "gltf":
        return "gltf" if head[:1] in (b"{", b"[") else None
    if ext in {"obj", "stl", "ply", "off"}:
        return ext
    return None


def build_trimesh_load_kwargs(filepath: str, **extra: Any) -> Dict[str, Any]:
    """构建 trimesh.load 参数，优先使用 sniff 到的真实格式。"""
    kwargs: Dict[str, Any] = dict(extra)
    sniffed = sniff_mesh_file_type(filepath)
    if sniffed:
        kwargs["file_type"] = sniffed
    return kwargs


def describe_mesh_format_mismatch(filepath: str, sniffed: Optional[str] = None) -> str:
    """生成可读的错误信息，替代 trimesh 的 incorrect header on GLB file。"""
    ext = Path(filepath).suffix.lower() or "(无扩展名)"
    detected = sniffed if sniffed is not None else sniff_mesh_file_type(filepath)
    size = get_file_size(filepath)
    if size == 0:
        return f"网格文件为空: {filepath}"
    if detected:
        return (
            f"网格文件扩展名 {ext} 与内容格式 .{detected} 不一致: {filepath}。"
            f"请重新上传/转换，或修正 inlay_cache 中的扩展名。"
        )
    if ext == ".glb":
        return (
            f"文件扩展名为 .glb 但缺少 glTF 文件头（可能为损坏文件、OBJ/STL 误标或 JSON 错误响应）: "
            f"{filepath} ({format_file_size(size)})。"
            f"请确认镶嵌网格为有效 OBJ/GLB/STL 并重试。"
        )
    return f"无法识别网格格式: {filepath} ({format_file_size(size)})"


def validate_mesh_file(filepath: str) -> bool:
    """
    验证是否为有效的3D网格文件（含可读顶点）
    """
    if not validate_file_exists(filepath):
        logger.error(f"网格文件不存在: {filepath}")
        return False
    sniffed = sniff_mesh_file_type(filepath)
    ext = Path(filepath).suffix.lower()
    if sniffed is None and ext == ".glb":
        logger.error("网格文件不是有效 GLB: %s", describe_mesh_format_mismatch(filepath))
        return False
    if sniffed is None and not validate_file_format(filepath, SUPPORTED_3D_FORMATS):
        logger.error(f"不支持的网格格式: {filepath}")
        return False
    try:
        import trimesh

        loaded = trimesh.load(
            filepath,
            **build_trimesh_load_kwargs(filepath, force="mesh", process=False),
        )
        if isinstance(loaded, trimesh.Scene):
            verts = sum(
                len(getattr(g, "vertices", []))
                for g in loaded.geometry.values()
                if hasattr(g, "vertices")
            )
        else:
            verts = len(getattr(loaded, "vertices", []))
        if verts <= 0:
            logger.error("网格文件无有效顶点: %s (sniffed=%s)", filepath, sniffed)
            return False
        return True
    except Exception as e:
        logger.error("网格文件无法解析: %s (%s)", filepath, e)
        return False


def copy_file(src: str, dst: str) -> str:
    """
    复制文件到目标路径
    """
    ensure_dir(os.path.dirname(dst))
    shutil.copy2(src, dst)
    logger.info(f"文件已复制: {src} -> {dst}")
    return dst


def get_file_size(filepath: str) -> int:
    """
    获取文件大小（字节）
    """
    if os.path.isfile(filepath):
        return os.path.getsize(filepath)
    return 0


def format_file_size(size_bytes: int) -> str:
    """
    格式化文件大小为人类可读格式
    """
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def list_files_in_dir(
    directory: str,
    extensions: Optional[List[str]] = None
) -> List[str]:
    """
    列出目录中的文件
    """
    if not os.path.isdir(directory):
        return []

    files = []
    for f in os.listdir(directory):
        filepath = os.path.join(directory, f)
        if os.path.isfile(filepath):
            if extensions is None:
                files.append(filepath)
            elif Path(f).suffix.lower() in extensions:
                files.append(filepath)
    return sorted(files)


def cleanup_task_files(output_dir: str, task_id: str) -> bool:
    """
    清理任务相关的临时文件
    """
    task_dir = get_task_dir(output_dir, task_id)
    if os.path.isdir(task_dir):
        try:
            shutil.rmtree(task_dir)
            logger.info(f"已清理任务文件: {task_dir}")
            return True
        except Exception as e:
            logger.error(f"清理任务文件失败: {e}")
            return False
    return True


def resolve_path(filepath: str, base_dir: Optional[str] = None) -> str:
    """
    解析文件路径，支持相对路径和绝对路径
    """
    path = Path(filepath)
    if path.is_absolute():
        return str(path)

    if base_dir:
        return str(Path(base_dir) / path)
    return str(path.resolve())


def save_upload_file(
    file_content: bytes,
    output_dir: str,
    original_filename: str,
    task_id: Optional[str] = None
) -> str:
    """
    保存上传的文件

    Args:
        file_content: 文件内容（字节）
        output_dir: 输出目录
        original_filename: 原始文件名
        task_id: 任务ID（可选）

    Returns:
        保存后的文件路径
    """
    if task_id:
        save_dir = os.path.join(output_dir, task_id)
    else:
        save_dir = os.path.join(output_dir, "uploads")

    ensure_dir(save_dir)

    # 生成唯一文件名避免冲突
    ext = Path(original_filename).suffix
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = os.path.join(save_dir, unique_name)

    with open(filepath, "wb") as f:
        f.write(file_content)

    logger.info(f"文件已保存: {filepath} ({format_file_size(len(file_content))})")
    return filepath
