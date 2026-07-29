#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""下载 InstructPix2Pix 模型到本地 models/instruct-pix2pix/"""

from __future__ import annotations

import argparse
import os
import sys

DEFAULT_SAVE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models",
    "instruct-pix2pix",
)

HF_REPO = "timbrooks/instruct-pix2pix"
HF_MIRRORS = ["https://hf-mirror.com", "https://huggingface.co"]


def verify_model(path: str) -> bool:
    index = os.path.join(path, "model_index.json")
    if not os.path.isfile(index):
        print(f"[FAIL] 缺少 model_index.json: {path}")
        return False
    print(f"[OK] 模型目录有效: {path}")
    return True


def download_model(save_dir: str) -> None:
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("请先安装 huggingface_hub: pip install huggingface_hub")
        sys.exit(1)

    os.makedirs(save_dir, exist_ok=True)
    last_err = None
    for endpoint in HF_MIRRORS:
        os.environ["HF_ENDPOINT"] = endpoint
        print(f"下载 {HF_REPO} -> {save_dir} (endpoint={endpoint})")
        try:
            snapshot_download(repo_id=HF_REPO, local_dir=save_dir)
            print("下载完成")
            return
        except Exception as e:
            last_err = e
            print(f"镜像 {endpoint} 失败: {e}")
    raise SystemExit(f"所有镜像均失败: {last_err}")


def main() -> None:
    parser = argparse.ArgumentParser(description="下载 InstructPix2Pix 宝石去反光模型")
    parser.add_argument(
        "--save-dir",
        default=DEFAULT_SAVE_DIR,
        help=f"保存目录（默认 {DEFAULT_SAVE_DIR}）",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="仅验证本地模型是否就绪",
    )
    args = parser.parse_args()

    if args.verify_only:
        ok = verify_model(args.save_dir)
        sys.exit(0 if ok else 1)

    if verify_model(args.save_dir):
        print("本地模型已存在，跳过下载")
        return

    download_model(args.save_dir)
    if not verify_model(args.save_dir):
        sys.exit(1)


if __name__ == "__main__":
    main()
