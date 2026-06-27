#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模型下载脚本 - Hunyuan3D-2 / Hunyuan3D-2mini

2026-06 仓库结构已更新：
- mini 仓库无 hunyuan3d-paint-v2-mini，纹理模型在完整版仓库 hunyuan3d-paint-v2-0
- mini 形状模型权重为 model.fp16.safetensors（约 3.6GB）
"""

import os
import sys
import argparse
import json
import urllib.request

DEFAULT_SAVE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"
)

MIRROR_SOURCES = [
    "https://hf-mirror.com",
    "https://huggingface.co",
]

# mini：仅下载形状 + VAE（纹理可选从完整版仓库拉取）
MODEL_CONFIGS = {
    "hunyuan3d-2mini": {
        "repo": "tencent/Hunyuan3D-2mini",
        "description": "Hunyuan3D-2mini 轻量版（适合 8GB GPU）",
        "subfolders": [
            "hunyuan3d-dit-v2-mini",
            "hunyuan3d-vae-v2-mini",
        ],
        "optional_subfolders": [],
    },
    "hunyuan3d-2": {
        "repo": "tencent/Hunyuan3D-2",
        "description": "Hunyuan3D-2 完整版（适合 16GB+ GPU）",
        "subfolders": [
            "hunyuan3d-dit-v2-0",
            "hunyuan3d-paint-v2-0",
            "hunyuan3d-vae-v2-0",
        ],
        "optional_subfolders": [],
    },
    "hunyuan3d-2mv": {
        "repo": "tencent/Hunyuan3D-2mv",
        "description": "Hunyuan3D-2mv 多视图形状生成（轨道A推荐，约 4GB+）",
        "subfolders": [
            "hunyuan3d-dit-v2-mv",
        ],
        "optional_subfolders": [
            "hunyuan3d-dit-v2-mv-turbo",
        ],
    },
    # mini + 纹理：形状来自 mini 仓库，纹理来自完整版仓库
    "hunyuan3d-2mini-with-paint": {
        "repo": "tencent/Hunyuan3D-2mini",
        "description": "Mini 形状 + 完整版纹理（推荐 8-12GB GPU）",
        "subfolders": [
            "hunyuan3d-dit-v2-mini",
            "hunyuan3d-vae-v2-mini",
        ],
        "extra_repos": [
            {
                "repo": "tencent/Hunyuan3D-2",
                "subfolders": ["hunyuan3d-paint-v2-0"],
                "local_subdir": "hunyuan3d-2",  # 保存到 models/hunyuan3d-2mini/../hunyuan3d-2/paint
            }
        ],
    },
}


def format_size(size_bytes):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def check_dependencies():
    try:
        import huggingface_hub
        print(f"[OK] huggingface_hub 版本: {huggingface_hub.__version__}")
        return True
    except ImportError:
        print("[!] 安装 huggingface_hub...")
        if os.system(f"{sys.executable} -m pip install -q huggingface_hub") != 0:
            return False
        return True


def fetch_tree(endpoint: str, repo_id: str, subfolder: str = "") -> list:
    """通过 HF API 列出仓库文件"""
    import ssl
    base = endpoint.rstrip("/")
    path = f"/api/models/{repo_id}/tree/main"
    if subfolder:
        path += f"/{subfolder}"
    url = base + path
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "jewelry3d-downloader/1.0"})
    # 跟随 308/301 重定向
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
    with opener.open(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_file(endpoint: str, repo_id: str, filename: str, local_dir: str) -> str:
    """单文件下载（兼容 hf-mirror）"""
    from huggingface_hub import hf_hub_download

    os.environ["HF_ENDPOINT"] = endpoint
    os.environ["HUGGINGFACE_HUB_ENDPOINT"] = endpoint
    kwargs = {
        "repo_id": repo_id,
        "filename": filename,
        "local_dir": local_dir,
        "local_dir_use_symlinks": False,
    }
    try:
        path = hf_hub_download(**kwargs, endpoint=endpoint)
    except TypeError:
        path = hf_hub_download(**kwargs)
    return path


def download_subfolder(endpoint: str, repo_id: str, subfolder: str, local_dir: str) -> None:
    """下载子目录下所有文件"""
    print(f"\n[*] 下载: {repo_id}/{subfolder}")
    entries = fetch_tree(endpoint, repo_id, subfolder)
    files = [e for e in entries if e.get("type") == "file"]
    if not files:
        raise FileNotFoundError(f"子目录为空或不存在: {subfolder}")

    for entry in files:
        rel_path = entry["path"]
        size = entry.get("size", 0)
        print(f"    -> {rel_path} ({format_size(size)})")
        download_file(endpoint, repo_id, rel_path, local_dir)
    print(f"[OK] {subfolder} 完成")


def download_model_variant(model_name: str, save_dir: str, endpoint: str) -> str:
    config = MODEL_CONFIGS[model_name]
    repo_id = config["repo"]
    model_save_dir = os.path.join(save_dir, model_name.split("-with-")[0] if "with-paint" in model_name else model_name)
    os.makedirs(model_save_dir, exist_ok=True)

    for subfolder in config["subfolders"]:
        download_subfolder(endpoint, repo_id, subfolder, model_save_dir)

    for extra in config.get("extra_repos", []):
        extra_dir = os.path.join(save_dir, extra.get("local_subdir", model_name))
        os.makedirs(extra_dir, exist_ok=True)
        for subfolder in extra["subfolders"]:
            download_subfolder(endpoint, extra["repo"], subfolder, extra_dir)

    return model_save_dir


def snapshot_fallback(model_name: str, save_dir: str, endpoint: str) -> None:
    """整库 snapshot 回退"""
    from huggingface_hub import snapshot_download

    config = MODEL_CONFIGS[model_name]
    os.environ["HF_ENDPOINT"] = endpoint
    target = os.path.join(save_dir, model_name.replace("-with-paint", ""))
    print(f"[*] 整库 snapshot 回退: {config['repo']} -> {target}")
    snapshot_download(
        repo_id=config["repo"],
        local_dir=target,
        local_dir_use_symlinks=False,
        max_workers=4,
    )


def verify_download(save_dir: str) -> bool:
    print("\n[*] 验证模型文件...")
    checks = [
        ("hunyuan3d-2mini/hunyuan3d-dit-v2-mini/config.yaml", "mini 形状配置"),
        ("hunyuan3d-2mini/hunyuan3d-dit-v2-mini/model.fp16.safetensors", "mini 形状权重 safetensors"),
        ("hunyuan3d-2mini/hunyuan3d-dit-v2-mini/model.fp16.ckpt", "mini 形状权重 ckpt"),
        ("hunyuan3d-2/hunyuan3d-dit-v2-0/config.yaml", "标准形状配置"),
        ("hunyuan3d-2/hunyuan3d-paint-v2-0/config.yaml", "纹理模型配置"),
        ("hunyuan3d-2mv/hunyuan3d-dit-v2-mv/config.yaml", "2mv 多视图形状配置"),
        ("hunyuan3d-2mv/hunyuan3d-dit-v2-mv/model.fp16.safetensors", "2mv 形状权重 safetensors"),
        ("hunyuan3d-2mv/hunyuan3d-dit-v2-mv/model.fp16.ckpt", "2mv 形状权重 ckpt"),
    ]
    found = False
    for rel, desc in checks:
        full = os.path.join(save_dir, rel)
        if os.path.isfile(full):
            print(f"  [OK] {desc}: {format_size(os.path.getsize(full))}")
            found = True

    if found:
        print("\n[OK] 检测到可用模型文件")
        return True
    print("\n[!] 未找到模型权重，请重新下载")
    return False


def print_manual_guide():
    print("""
============================================================
  手动下载指引（2026-06 更新）
============================================================

mini 仓库实际目录（无 paint-v2-mini）：
  https://hf-mirror.com/tencent/Hunyuan3D-2mini/tree/main

必下（8GB GPU）：
  hunyuan3d-dit-v2-mini/config.yaml
  hunyuan3d-dit-v2-mini/model.fp16.safetensors  (~3.6GB)
  hunyuan3d-vae-v2-mini/                        (可选，VAE)

纹理（可选，来自完整版仓库）：
  https://hf-mirror.com/tencent/Hunyuan3D-2/tree/main/hunyuan3d-paint-v2-0

放置路径：
  3d_aigc_project/models/hunyuan3d-2mini/
    ├── hunyuan3d-dit-v2-mini/
    └── hunyuan3d-vae-v2-mini/

Git LFS 一键下载（推荐，需 Git LFS）：
  git lfs install
  git clone https://hf-mirror.com/tencent/Hunyuan3D-2mini models/hunyuan3d-2mini

脚本下载：
  python scripts/download-models.py --model hunyuan3d-2mini --mirror https://hf-mirror.com
============================================================
""")


def main():
    parser = argparse.ArgumentParser(description="下载 Hunyuan3D-2 模型")
    parser.add_argument("--save-dir", default=DEFAULT_SAVE_DIR)
    parser.add_argument("--mirror", default=None)
    parser.add_argument(
        "--model",
        default="hunyuan3d-2mini",
        choices=list(MODEL_CONFIGS.keys()),
    )
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--manual", action="store_true")
    args = parser.parse_args()

    if args.manual:
        print_manual_guide()
        return
    if args.verify_only:
        verify_download(args.save_dir)
        return
    if not check_dependencies():
        print_manual_guide()
        sys.exit(1)

    print("=" * 60)
    print("  珠宝3D生成系统 - 模型下载工具 v2")
    print("=" * 60)
    print(f"  模型: {args.model}")
    print(f"  路径: {args.save_dir}")
    print("=" * 60)

    success = False
    mirrors = [args.mirror] if args.mirror else MIRROR_SOURCES

    for mirror in mirrors:
        print(f"\n[*] 镜像: {mirror}")
        try:
            cfg = MODEL_CONFIGS[args.model]
            print(f"  {cfg['description']}")
            download_model_variant(args.model, args.save_dir, mirror)
            success = True
            break
        except Exception as e:
            print(f"[FAIL] 分文件下载失败: {e}")
            try:
                snapshot_fallback(args.model, args.save_dir, mirror)
                success = True
                break
            except Exception as e2:
                print(f"[FAIL] snapshot 回退失败: {e2}")

    if not success:
        print_manual_guide()
        sys.exit(1)

    verify_download(args.save_dir)
    print("\n[OK] 下载流程结束")


if __name__ == "__main__":
    main()
