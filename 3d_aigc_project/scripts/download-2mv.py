#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
下载 Hunyuan3D-2mv（多视图形状模型）
通过 hf-mirror resolve URL 直连，避免 huggingface.co 超时。
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAVE_DIR = ROOT / "models" / "hunyuan3d-2mv"
REPO = "tencent/Hunyuan3D-2mv"
SUBFOLDER = "hunyuan3d-dit-v2-mv"
MIRRORS = [
    "https://hf-mirror.com",
    "https://huggingface.co",
]


def format_size(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.2f} {u}"
        n /= 1024
    return f"{n:.2f} TB"


def fetch_tree(mirror: str) -> list:
    url = f"{mirror.rstrip('/')}/api/models/{REPO}/tree/main/{SUBFOLDER}"
    req = urllib.request.Request(url, headers={"User-Agent": "jewelry3d-2mv/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_resolve(mirror: str, rel_path: str, dest: Path) -> None:
    url = f"{mirror.rstrip('/')}/{REPO}/resolve/main/{rel_path}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 0:
        print(f"  [skip] 已存在 {dest.name} ({format_size(dest.stat().st_size)})")
        return
    print(f"  -> {rel_path}")
    req = urllib.request.Request(url, headers={"User-Agent": "jewelry3d-2mv/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        done = 0
        chunk = 1024 * 1024
        with open(dest, "wb") as f:
            while True:
                buf = resp.read(chunk)
                if not buf:
                    break
                f.write(buf)
                done += len(buf)
                if total > 0 and done % (50 * chunk) < chunk:
                    pct = done * 100 // total
                    print(f"     {format_size(done)} / {format_size(total)} ({pct}%)")
    print(f"  [ok] {dest.name} ({format_size(dest.stat().st_size)})")


def verify() -> bool:
    cfg = SAVE_DIR / SUBFOLDER / "config.yaml"
    weights = [
        SAVE_DIR / SUBFOLDER / "model.fp16.safetensors",
        SAVE_DIR / SUBFOLDER / "model.fp16.ckpt",
    ]
    if not cfg.is_file():
        print("[!] 缺少 config.yaml")
        return False
    if not any(w.is_file() and w.stat().st_size > 1_000_000 for w in weights):
        print("[!] 缺少权重文件 model.fp16.safetensors 或 .ckpt")
        return False
    w = next(w for w in weights if w.is_file())
    print(f"[OK] 2mv 就绪: {cfg}")
    print(f"[OK] 权重: {w} ({format_size(w.stat().st_size)})")
    if "MVImageProcessorV2" not in cfg.read_text(encoding="utf-8"):
        print("[!] config.yaml 未包含 MVImageProcessorV2，可能不是多视图模型")
        return False
    print("[OK] MVImageProcessorV2 已确认")
    return True


def main() -> int:
    print("=" * 60)
    print("  Hunyuan3D-2mv 下载")
    print(f"  目标: {SAVE_DIR / SUBFOLDER}")
    print("=" * 60)

    entries = None
    mirror_used = None
    for mirror in MIRRORS:
        try:
            print(f"\n[*] 列举文件: {mirror}")
            entries = fetch_tree(mirror)
            mirror_used = mirror
            break
        except Exception as e:
            print(f"  [fail] {e}")

    if not entries:
        print("\n[!] 无法连接镜像，请检查网络或 VPN")
        return 1

    files = [e for e in entries if e.get("type") == "file"]
    print(f"[*] 共 {len(files)} 个文件，镜像: {mirror_used}")

    for entry in files:
        rel = entry["path"]
        size = entry.get("size", 0)
        dest = SAVE_DIR / rel.replace("/", os.sep)
        print(f"\n[{rel}] ({format_size(size)})")
        try:
            download_resolve(mirror_used, rel, dest)
        except Exception as e:
            print(f"  [fail] {e}")
            return 1

    print()
    if verify():
        print("\n[OK] 下载完成。请重启 AI 服务（MODEL_VERSION=mv 已在 start 脚本中配置）")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
