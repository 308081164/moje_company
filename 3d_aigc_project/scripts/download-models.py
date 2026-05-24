#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型下载脚本
从HuggingFace下载Hunyuan3D-2模型到本地models/目录
支持多种下载方式：huggingface_hub / 镜像站 / 手动下载指引

正确的模型仓库地址：
- 主仓库: https://huggingface.co/tencent/Hunyuan3D-2
- Mini仓库: https://huggingface.co/tencent/Hunyuan3D-2mini
"""

import os
import sys
import argparse
from pathlib import Path

# ============================================================
# 模型配置 - 已修正的仓库地址
# ============================================================
MODEL_CONFIGS = {
    "hunyuan3d-2": {
        "repo": "tencent/Hunyuan3D-2",  # 正确的仓库地址
        "description": "Hunyuan3D-2 完整版（适合16GB+ GPU）",
        "subfolders": [
            "hunyuan3d-dit-v2-0",       # 标准版DiT模型
            "hunyuan3d-paint-v2-0",     # 纹理生成模型
        ],
    },
    "hunyuan3d-2mini": {
        "repo": "tencent/Hunyuan3D-2mini",  # Mini版本仓库
        "description": "Hunyuan3D-2mini 轻量版（适合8GB GPU）",
        "subfolders": [
            "hunyuan3d-dit-v2-mini",    # mini版DiT模型
            "hunyuan3d-paint-v2-mini",  # mini版纹理生成
        ],
    },
}

# 默认保存目录
DEFAULT_SAVE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

# 镜像源列表（按优先级排序）
MIRROR_SOURCES = [
    "https://hf-mirror.com",
    "https://huggingface.co",
]


def check_dependencies():
    """检查并安装必要依赖"""
    try:
        import huggingface_hub
        print(f"[OK] huggingface_hub 版本: {huggingface_hub.__version__}")
        return True
    except ImportError:
        print("[!] 缺少依赖: huggingface_hub")
        print("[*] 正在安装 huggingface_hub...")
        ret = os.system(f"{sys.executable} -m pip install -q huggingface_hub")
        if ret == 0:
            print("[OK] 安装成功")
            return True
        else:
            print("[x] 安装失败，请手动执行: pip install huggingface_hub")
            return False


def format_size(size_bytes):
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def download_with_hub(repo_id, save_dir, allow_patterns=None, endpoint=None):
    """使用huggingface_hub下载模型"""
    from huggingface_hub import snapshot_download

    if endpoint:
        os.environ["HF_ENDPOINT"] = endpoint

    kwargs = {
        "repo_id": repo_id,
        "local_dir": save_dir,
        "max_workers": 4,
    }
    if allow_patterns:
        kwargs["allow_patterns"] = allow_patterns

    return snapshot_download(**kwargs)


def download_model_variant(model_name, save_dir, endpoint=None):
    """下载指定模型变体"""
    config = MODEL_CONFIGS[model_name]
    repo_id = config["repo"]
    subfolders = config["subfolders"]

    model_save_dir = os.path.join(save_dir, model_name)
    os.makedirs(model_save_dir, exist_ok=True)

    for subfolder in subfolders:
        print(f"\n[*] 下载子模块: {subfolder}")
        allow_patterns = [f"{subfolder}/*"]

        try:
            local_dir = download_with_hub(
                repo_id=repo_id,
                save_dir=model_save_dir,
                allow_patterns=allow_patterns,
                endpoint=endpoint,
            )
            print(f"[OK] {subfolder} 下载完成")
        except Exception as e:
            print(f"[FAIL] {subfolder} 下载失败: {e}")
            raise

    return model_save_dir


def print_manual_guide():
    """打印手动下载指引 - 已修正地址"""
    print("""
============================================================
  手动下载指引（已修正地址）
============================================================

如果自动下载失败，请按以下步骤手动下载：

【方式1：浏览器下载】
1. 访问正确的HuggingFace仓库：
   https://huggingface.co/tencent/Hunyuan3D-2
   
   或使用国内镜像：
   https://hf-mirror.com/tencent/Hunyuan3D-2

2. 根据你的GPU显存选择下载：

   【8GB显存 - 下载mini版本】
   目录: hunyuan3d-dit-v2-mini/
   文件: config.yaml, model.fp16.safetensors (~1.2GB)
   
   目录: hunyuan3d-paint-v2-mini/
   文件: config.yaml, model.fp16.safetensors (~1.5GB)
   
   【16GB+显存 - 下载完整版】
   目录: hunyuan3d-dit-v2-0/
   文件: config.yaml, model.fp16.safetensors (~2.5GB)
   
   目录: hunyuan3d-paint-v2-0/
   文件: config.yaml, model.fp16.safetensors (~3GB)

3. 放置到项目目录：
   3d_aigc_project/models/
   └── hunyuan3d-2mini/          (8GB版本)
       ├── hunyuan3d-dit-v2-mini/
       └── hunyuan3d-paint-v2-mini/
   
   或
   
   3d_aigc_project/models/
   └── hunyuan3d-2/              (16GB+版本)
       ├── hunyuan3d-dit-v2-0/
       └── hunyuan3d-paint-v2-0/

【方式2：git clone下载】
   # 安装 git-lfs
   git lfs install
   
   # 下载完整版（16GB+）
   git clone https://huggingface.co/tencent/Hunyuan3D-2 \
             models/hunyuan3d-2
   
   # 或下载mini版（8GB）
   git clone https://huggingface.co/tencent/Hunyuan3D-2mini \
             models/hunyuan3d-2mini
   
   # 国内镜像
   git clone https://hf-mirror.com/tencent/Hunyuan3D-2mini \
             models/hunyuan3d-2mini

【方式3：ModelScope下载（国内推荐）】
   pip install modelscope
   
   python -c "
   from modelscope import snapshot_download
   # mini版本
   snapshot_download('tencent/Hunyuan3D-2mini',
                     local_dir='models/hunyuan3d-2mini')
   # 或完整版
   snapshot_download('tencent/Hunyuan3D-2',
                     local_dir='models/hunyuan3d-2')
   "

【方式4：GitHub Release下载】
   如果HuggingFace无法访问，可以尝试GitHub：
   https://github.com/Tencent/Hunyuan3D-2/releases

============================================================
""")


def verify_download(save_dir):
    """验证下载的模型文件"""
    print("\n[*] 验证模型文件...")

    # 检查mini版本
    mini_files = {
        "hunyuan3d-2mini/hunyuan3d-dit-v2-mini/config.yaml": "mini形状生成配置",
        "hunyuan3d-2mini/hunyuan3d-dit-v2-mini/model.fp16.safetensors": "mini形状生成权重",
    }

    # 检查完整版
    full_files = {
        "hunyuan3d-2/hunyuan3d-dit-v2-0/config.yaml": "标准形状生成配置",
        "hunyuan3d-2/hunyuan3d-dit-v2-0/model.fp16.safetensors": "标准形状生成权重",
    }

    found_mini = False
    found_full = False

    for rel_path, desc in mini_files.items():
        full_path = os.path.join(save_dir, rel_path)
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            print(f"  [OK] {desc}: {format_size(size)}")
            found_mini = True

    for rel_path, desc in full_files.items():
        full_path = os.path.join(save_dir, rel_path)
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            print(f"  [OK] {desc}: {format_size(size)}")
            found_full = True

    if found_mini or found_full:
        print("\n[OK] 模型文件已就绪！")
        if found_mini:
            print("  → 检测到mini版本（适合8GB GPU）")
        if found_full:
            print("  → 检测到标准版本（适合16GB+ GPU）")
        return True
    else:
        print("\n[!] 未找到模型文件")
        return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='下载Hunyuan3D-2模型')
    parser.add_argument(
        '--save-dir', type=str, default=DEFAULT_SAVE_DIR,
        help=f'模型保存目录 (默认: {DEFAULT_SAVE_DIR})'
    )
    parser.add_argument(
        '--mirror', type=str, default=None,
        help='指定镜像源URL (默认自动选择)'
    )
    parser.add_argument(
        '--model', type=str, default='hunyuan3d-2mini',
        choices=['hunyuan3d-2', 'hunyuan3d-2mini'],
        help='要下载的模型 (默认: hunyuan3d-2mini 适合8GB GPU)'
    )
    parser.add_argument(
        '--verify-only', action='store_true',
        help='仅验证已下载的文件'
    )
    parser.add_argument(
        '--manual', action='store_true',
        help='显示手动下载指引'
    )

    args = parser.parse_args()

    # 手动下载指引
    if args.manual:
        print_manual_guide()
        return

    # 仅验证
    if args.verify_only:
        verify_download(args.save_dir)
        return

    # 检查依赖
    if not check_dependencies():
        print_manual_guide()
        sys.exit(1)

    print("=" * 60)
    print("  珠宝3D生成系统 - 模型下载工具")
    print("=" * 60)
    print(f"  目标模型: {args.model}")
    print(f"  保存路径: {args.save_dir}")
    print(f"  镜像源: {args.mirror or '自动选择'}")
    print("=" * 60)

    # 尝试下载
    success = False
    for mirror in ([args.mirror] if args.mirror else MIRROR_SOURCES):
        if success:
            break

        print(f"\n[*] 尝试镜像源: {mirror}")
        os.environ["HF_ENDPOINT"] = mirror

        config = MODEL_CONFIGS[args.model]
        print(f"\n{'─' * 50}")
        print(f"  {config['description']}")
        print(f"  仓库: {config['repo']}")
        print(f"{'─' * 50}")

        try:
            download_model_variant(
                model_name=args.model,
                save_dir=args.save_dir,
                endpoint=mirror,
            )
            success = True
        except Exception as e:
            print(f"\n[FAIL] 镜像源 {mirror} 下载失败")
            print(f"  错误: {e}")
            success = False

    if not success:
        print("\n" + "=" * 60)
        print("[!] 所有镜像源均下载失败")
        print("=" * 60)
        print_manual_guide()
        sys.exit(1)

    # 验证下载
    verify_download(args.save_dir)

    # 统计
    print(f"\n{'=' * 60}")
    print("[OK] 模型下载完成！")
    total_size = 0
    file_count = 0
    for root, dirs, files in os.walk(args.save_dir):
        for f in files:
            fp = os.path.join(root, f)
            if os.path.isfile(fp):
                total_size += os.path.getsize(fp)
                file_count += 1
    print(f"  文件数: {file_count}")
    print(f"  总大小: {format_size(total_size)}")
    print(f"  保存位置: {args.save_dir}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
