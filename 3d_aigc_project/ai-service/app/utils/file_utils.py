"""
文件处理工具模块
提供文件保存、格式转换、路径管理等工具函数
"""

import os
import uuid
import shutil
import logging
from pathlib import Path
from typing import Optional, List
from datetime import datetime

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
    return True


def validate_mesh_file(filepath: str) -> bool:
    """
    验证是否为有效的3D网格文件
    """
    if not validate_file_exists(filepath):
        logger.error(f"网格文件不存在: {filepath}")
        return False
    if not validate_file_format(filepath, SUPPORTED_3D_FORMATS):
        logger.error(f"不支持的网格格式: {filepath}")
        return False
    return True


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
