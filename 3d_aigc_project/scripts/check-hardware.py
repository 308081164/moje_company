#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬件检测脚本
检测GPU型号、显存大小、CUDA可用性等信息
根据硬件配置推荐合适的模型版本
"""

import sys
import platform


def check_cuda():
    """检测CUDA可用性"""
    print("\n" + "=" * 50)
    print("  CUDA 检测")
    print("=" * 50)

    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"  PyTorch版本: {torch.__version__}")
        print(f"  CUDA可用: {'是' if cuda_available else '否'}")

        if cuda_available:
            cuda_version = torch.version.cuda
            cudnn_version = torch.backends.cudnn.version() if torch.backends.cudnn.is_available() else None
            print(f"  CUDA版本: {cuda_version}")
            print(f"  cuDNN版本: {cudnn_version}")
            return True, torch
        else:
            print("  [!] CUDA不可用，将使用CPU模式（速度较慢）")
            return False, torch

    except ImportError:
        print("  [!] 未安装PyTorch")
        print("  [*] 请执行: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
        return False, None


def check_gpu(torch_module=None):
    """检测GPU信息"""
    print("\n" + "=" * 50)
    print("  GPU 检测")
    print("=" * 50)

    if torch_module and torch_module.cuda.is_available():
        gpu_count = torch_module.cuda.device_count()
        print(f"  GPU数量: {gpu_count}")

        for i in range(gpu_count):
            name = torch_module.cuda.get_device_name(i)
            memory_total = torch_module.cuda.get_device_properties(i).total_memory / (1024 ** 3)
            memory_allocated = torch_module.cuda.memory_allocated(i) / (1024 ** 3)
            print(f"\n  GPU {i}: {name}")
            print(f"    总显存: {memory_total:.1f} GB")
            print(f"    已使用: {memory_allocated:.2f} GB")
            print(f"    可用: {memory_total - memory_allocated:.1f} GB")

        # 返回第一张GPU的信息
        primary_gpu = {
            'name': torch_module.cuda.get_device_name(0),
            'memory_gb': torch_module.cuda.get_device_properties(0).total_memory / (1024 ** 3),
        }
        return primary_gpu
    else:
        print("  [!] 未检测到GPU")
        return None


def check_system():
    """检测系统信息"""
    print("\n" + "=" * 50)
    print("  系统信息")
    print("=" * 50)

    print(f"  操作系统: {platform.system()} {platform.release()}")
    print(f"  Python版本: {platform.python_version()}")
    print(f"  处理器: {platform.processor()}")


def recommend_model(gpu_info=None, cuda_available=False):
    """根据硬件推荐模型版本"""
    print("\n" + "=" * 50)
    print("  模型版本推荐")
    print("=" * 50)

    if not cuda_available or not gpu_info:
        print("  [!] 未检测到可用GPU")
        print("  推荐版本: CPU模式（仅用于测试，速度极慢）")
        print("  建议: 安装NVIDIA显卡和CUDA驱动以获得最佳体验")
        return

    memory_gb = gpu_info['memory_gb']
    gpu_name = gpu_info['name']

    print(f"  GPU: {gpu_name}")
    print(f"  显存: {memory_gb:.1f} GB")

    # 根据显存大小推荐模型版本
    if memory_gb >= 24:
        print("\n  [推荐] standard 版本")
        print("    - 最高质量输出")
        print("    - 生成速度较慢")
        print("    - 需要至少24GB显存")
        print("    - 环境变量: MODEL_VERSION=standard")
    elif memory_gb >= 12:
        print("\n  [推荐] turbo 版本")
        print("    - 高质量输出")
        print("    - 生成速度适中")
        print("    - 需要至少12GB显存")
        print("    - 环境变量: MODEL_VERSION=turbo")
    elif memory_gb >= 8:
        print("\n  [推荐] mini 版本")
        print("    - 标准质量输出")
        print("    - 生成速度较快")
        print("    - 需要至少8GB显存")
        print("    - 环境变量: MODEL_VERSION=mini")
    else:
        print("\n  [推荐] mini 版本（低显存模式）")
        print("    - 可能需要降低batch size")
        print("    - 显存不足时可能报错")
        print("    - 环境变量: MODEL_VERSION=mini")
        print("    - 建议: 升级到8GB以上显存的GPU")

    print(f"\n  [自动模式] MODEL_VERSION=auto")
    print("    - 系统将根据可用显存自动选择最佳版本")


def check_disk_space():
    """检查磁盘空间"""
    print("\n" + "=" * 50)
    print("  磁盘空间")
    print("=" * 50)

    try:
        import shutil
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        total, used, free = shutil.disk_usage(project_dir)

        print(f"  项目目录: {project_dir}")
        print(f"  总空间: {total / (1024**3):.1f} GB")
        print(f"  已使用: {used / (1024**3):.1f} GB")
        print(f"  可用空间: {free / (1024**3):.1f} GB")

        # 模型文件大约需要10-20GB
        if free < 10 * 1024 ** 3:
            print("  [!] 磁盘空间不足，模型下载可能失败（建议至少20GB可用空间）")
        elif free < 20 * 1024 ** 3:
            print("  [!] 磁盘空间较紧张，建议清理后下载模型")
        else:
            print("  [√] 磁盘空间充足")
    except Exception as e:
        print(f"  [!] 无法检测磁盘空间: {e}")


def main():
    """主函数"""
    import os

    print("=" * 50)
    print("  3D AIGC - 硬件检测工具")
    print("=" * 50)

    # 1. 系统信息
    check_system()

    # 2. CUDA检测
    cuda_available, torch_module = check_cuda()

    # 3. GPU检测
    gpu_info = check_gpu(torch_module)

    # 4. 磁盘空间
    check_disk_space()

    # 5. 模型推荐
    recommend_model(gpu_info, cuda_available)

    # 总结
    print("\n" + "=" * 50)
    print("  检测完成")
    print("=" * 50)

    if cuda_available and gpu_info:
        print("  [√] 硬件环境满足要求，可以开始使用")
        print("  [*] 请运行以下命令下载模型:")
        print("      python scripts/download-models.py")
    elif cuda_available:
        print("  [!] CUDA可用但未检测到GPU")
        print("  [*] 请检查GPU驱动是否正确安装")
    else:
        print("  [x] 未检测到CUDA环境")
        print("  [*] 请按以下步骤配置:")
        print("      1. 安装NVIDIA显卡驱动")
        print("      2. 安装CUDA Toolkit (12.1+)")
        print("      3. 安装PyTorch (CUDA版本)")
        print("      pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")


if __name__ == '__main__':
    main()
