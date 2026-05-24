"""
GPU硬件检测模块
检测NVIDIA GPU型号、显存大小，返回推荐的模型配置
"""

import subprocess
import re
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    """GPU信息数据类"""
    gpu_name: str = "Unknown"
    vram_gb: float = 0.0
    driver_version: str = "Unknown"
    cuda_version: str = "Unknown"
    is_available: bool = False


@dataclass
class ModelRecommendation:
    """模型推荐配置"""
    model_version: str = "mini"  # mini / standard / turbo
    batch_size: int = 1
    image_resolution: int = 256  # 输入图像分辨率
    point_cloud_density: int = 2048  # 点云密度
    reason: str = ""


def _run_nvidia_smi() -> Optional[str]:
    """
    执行 nvidia-smi 命令获取GPU信息
    返回命令输出字符串，失败返回None
    """
    try:
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except FileNotFoundError:
        logger.warning("nvidia-smi 未找到，可能未安装NVIDIA驱动")
        return None
    except subprocess.TimeoutExpired:
        logger.warning("nvidia-smi 执行超时")
        return None
    except Exception as e:
        logger.error(f"执行 nvidia-smi 时出错: {e}")
        return None


def _parse_nvidia_smi(output: str) -> GPUInfo:
    """
    解析 nvidia-smi 输出，提取GPU信息
    支持多GPU环境，返回第一张GPU的信息
    """
    info = GPUInfo()

    # 检测是否有GPU
    if "No devices were found" in output:
        logger.info("未检测到NVIDIA GPU设备")
        return info

    # 提取GPU型号（取第一张GPU）
    gpu_match = re.search(
        r"\|\s+\d+\s+(.+?)\s+\|.*\|",
        output
    )
    if gpu_match:
        info.gpu_name = gpu_match.group(1).strip()

    # 提取显存大小（取第一张GPU的显存）
    # 匹配格式如 "8192 MiB" 或 "24576 MiB"
    vram_match = re.search(
        r"\|\s+\d+\s+MiB\s+\|\s+\d+\s+MiB\s+\|\s+(\d+)\s+MiB",
        output
    )
    if vram_match:
        vram_mib = int(vram_match.group(1))
        info.vram_gb = round(vram_mib / 1024, 2)

    # 提取驱动版本
    driver_match = re.search(
        r"Driver Version:\s+([\d.]+)",
        output
    )
    if driver_match:
        info.driver_version = driver_match.group(1)

    # 提取CUDA版本
    cuda_match = re.search(
        r"CUDA Version:\s+([\d.]+)",
        output
    )
    if cuda_match:
        info.cuda_version = cuda_match.group(1)

    info.is_available = True
    return info


def _check_torch_cuda() -> Dict[str, Any]:
    """
    通过PyTorch检测CUDA可用性
    作为 nvidia-smi 的补充检测手段
    """
    result = {
        "cuda_available": False,
        "torch_cuda_version": None,
        "device_count": 0,
        "device_name": None,
    }
    try:
        import torch
        result["cuda_available"] = torch.cuda.is_available()
        if result["cuda_available"]:
            result["torch_cuda_version"] = torch.version.cuda
            result["device_count"] = torch.cuda.device_count()
            result["device_name"] = torch.cuda.get_device_name(0)
    except ImportError:
        logger.warning("PyTorch未安装，无法通过torch检测CUDA")
    except Exception as e:
        logger.error(f"通过PyTorch检测CUDA时出错: {e}")
    return result


def detect_gpu() -> GPUInfo:
    """
    检测GPU信息
    优先使用 nvidia-smi，辅以 PyTorch 检测
    """
    # 方法1: 通过 nvidia-smi 检测
    smi_output = _run_nvidia_smi()
    if smi_output:
        info = _parse_nvidia_smi(smi_output)
        if info.is_available:
            logger.info(
                f"GPU检测成功: {info.gpu_name}, "
                f"显存: {info.vram_gb}GB, "
                f"驱动: {info.driver_version}, "
                f"CUDA: {info.cuda_version}"
            )
            return info

    # 方法2: 通过 PyTorch 检测
    torch_info = _check_torch_cuda()
    if torch_info["cuda_available"]:
        info = GPUInfo(
            gpu_name=torch_info["device_name"] or "Unknown",
            is_available=True,
            cuda_version=torch_info["torch_cuda_version"] or "Unknown",
        )
        # PyTorch检测不到显存大小，尝试从GPU名称推断
        info.vram_gb = _estimate_vram_from_name(info.gpu_name)
        logger.info(
            f"通过PyTorch检测到GPU: {info.gpu_name}, "
            f"预估显存: {info.vram_gb}GB"
        )
        return info

    logger.warning("未检测到可用的GPU，将使用CPU模式（性能较低）")
    return GPUInfo()


def _estimate_vram_from_name(gpu_name: str) -> float:
    """
    根据GPU型号名称估算显存大小
    常见消费级和专业级GPU的显存对照表
    """
    name_lower = gpu_name.lower()

    # 已知GPU型号的显存映射表（单位：GB）
    known_vram = {
        # RTX 40系列
        "rtx 4090": 24, "rtx 4080": 16, "rtx 4080 super": 16,
        "rtx 4070 ti super": 16, "rtx 4070 ti": 12, "rtx 4070 super": 12,
        "rtx 4070": 12, "rtx 4060 ti": 16, "rtx 4060": 8,
        "rtx 4050": 6,
        # RTX 30系列
        "rtx 3090": 24, "rtx 3090 ti": 24,
        "rtx 3080": 12, "rtx 3080 ti": 12,
        "rtx 3070": 8, "rtx 3070 ti": 8,
        "rtx 3060": 12, "rtx 3060 ti": 8,
        "rtx 3050": 8,
        # RTX 20系列
        "rtx 2080 ti": 11, "rtx 2080": 8, "rtx 2080 super": 8,
        "rtx 2070": 8, "rtx 2070 super": 8,
        "rtx 2060": 6, "rtx 2060 super": 8,
        # GTX 10系列
        "gtx 1080 ti": 11, "gtx 1080": 8,
        "gtx 1070": 8, "gtx 1070 ti": 8,
        "gtx 1060": 6,
        # 数据中心/专业卡
        "a100": 80, "a100 80": 80, "a100 40": 40,
        "h100": 80, "h200": 141,
        "a6000": 48, "a5000": 24, "a4000": 16, "a3000": 12,
        "rtx a6000": 48, "rtx a5000": 24, "rtx a4000": 16,
        "rtx 6000 ada": 48, "rtx 5000 ada": 32,
        "l40s": 48, "l40": 48, "l4": 24,
        "v100": 32, "v100s": 32,
        "tesla t4": 16,
        "tesla p40": 24, "tesla p100": 16,
        # RTX 50系列
        "rtx 5090": 32, "rtx 5080": 16, "rtx 5070 ti": 16,
        "rtx 5070": 12, "rtx 5060 ti": 16, "rtx 5060": 8,
    }

    for model_name, vram in known_vram.items():
        if model_name in name_lower:
            return float(vram)

    # 未知型号，默认返回8GB（保守估计）
    logger.warning(f"未知GPU型号 '{gpu_name}'，默认预估显存为8GB")
    return 8.0


def get_recommended_model(gpu_info: GPUInfo) -> ModelRecommendation:
    """
    根据GPU显存大小推荐模型版本和参数配置

    推荐策略:
    - 8GB以下: mini模型（轻量级，适合消费级显卡）
    - 8-16GB: standard模型（标准版，适合RTX 3070/4070级别）
    - 16GB以上: turbo模型（高性能，适合RTX 4090/A100级别）
    - 无GPU: mini模型（CPU模式）
    """
    vram = gpu_info.vram_gb

    if not gpu_info.is_available:
        return ModelRecommendation(
            model_version="mini",
            batch_size=1,
            image_resolution=256,
            point_cloud_density=2048,
            reason="未检测到GPU，使用mini模型（CPU模式），性能较低"
        )

    if vram < 8:
        return ModelRecommendation(
            model_version="mini",
            batch_size=1,
            image_resolution=256,
            point_cloud_density=2048,
            reason=f"GPU显存 {vram}GB < 8GB，推荐使用mini模型"
        )
    elif vram < 16:
        return ModelRecommendation(
            model_version="standard",
            batch_size=1,
            image_resolution=384,
            point_cloud_density=4096,
            reason=f"GPU显存 {vram}GB 在 8-16GB 之间，推荐使用standard模型"
        )
    else:
        return ModelRecommendation(
            model_version="turbo",
            batch_size=2,
            image_resolution=512,
            point_cloud_density=8192,
            reason=f"GPU显存 {vram}GB >= 16GB，推荐使用turbo模型"
        )


def get_system_info() -> Dict[str, Any]:
    """
    获取完整的系统信息，用于API接口返回
    """
    gpu_info = detect_gpu()
    recommendation = get_recommended_model(gpu_info)

    return {
        "gpu_name": gpu_info.gpu_name,
        "vram_gb": gpu_info.vram_gb,
        "cuda_version": gpu_info.cuda_version,
        "driver_version": gpu_info.driver_version,
        "gpu_available": gpu_info.is_available,
        "recommended_model": recommendation.model_version,
        "recommended_config": {
            "batch_size": recommendation.batch_size,
            "image_resolution": recommendation.image_resolution,
            "point_cloud_density": recommendation.point_cloud_density,
        },
        "recommendation_reason": recommendation.reason,
    }
