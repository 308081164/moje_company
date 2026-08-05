#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
宝石去反光 AI 重绘 E2E 验证脚本

用法（容器内）:
  python /tmp/e2e_test_gem_repaint.py /path/to/image.png
  python /tmp/e2e_test_gem_repaint.py /path/to/image.png --x 320 --y 240
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, "/app" if os.path.isdir("/app") else os.path.join(os.path.dirname(__file__), "..", "ai-service"))


def main() -> int:
    parser = argparse.ArgumentParser(description="E2E test gem repaint (SAM + Ip2p)")
    parser.add_argument("image", help="输入图像路径")
    parser.add_argument("--x", type=float, default=0.5, help="SAM 正点 x（0~1 或像素）")
    parser.add_argument("--y", type=float, default=0.45, help="SAM 正点 y（0~1 或像素）")
    parser.add_argument("--strength", type=float, default=0.45)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out-dir", default=None)
    args = parser.parse_args()

    if not os.path.isfile(args.image):
        print(f"[FAIL] 图像不存在: {args.image}")
        return 1

    from PIL import Image

    from app.services.preprocess.pipeline import gem_repaint_sam_from_image

    with Image.open(args.image) as img:
        source = img.convert("RGBA")
    w, h = source.size
    px = args.x * w if args.x <= 1.0 else args.x
    py = args.y * h if args.y <= 1.0 else args.y
    points = [{"x": px, "y": py, "label": 1}]

    print(f"[1] 输入: {args.image} ({w}x{h})")
    print(f"[2] SAM 点: ({px:.1f}, {py:.1f}) strength={args.strength} seed={args.seed}")

    t0 = time.perf_counter()
    try:
        result = gem_repaint_sam_from_image(
            source,
            points,
            strength=args.strength,
            seed=args.seed,
            preserve_edges=True,
            mask_dilate_px=8,
        )
    except Exception as e:
        print(f"[FAIL] 重绘失败: {e}")
        return 1
    elapsed = time.perf_counter() - t0

    out_dir = args.out_dir or os.path.dirname(os.path.abspath(args.image))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "gem_repaint_e2e.png")
    with Image.open(result["processed_path"]) as out_img:
        out_img.save(out_path)

    summary = {
        "elapsed_sec": round(elapsed, 2),
        "session_id": result.get("session_id"),
        "coverage": result.get("gem_coverage_ratio"),
        "segment_method": result.get("segment_method"),
        "repaint_method": result.get("repaint_method"),
        "output": out_path,
        "preview_url": result.get("preview_url"),
    }
    print(f"[OK] 完成 ({elapsed:.2f}s)")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
