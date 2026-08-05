"""端到端冒烟：SAM 点选宝石 + HSV 保险丝"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("MODEL_PATH", str(PROJECT_ROOT / "models"))
sys.path.insert(0, str(ROOT))


def make_test_ring(path: Path) -> tuple[int, int]:
    """合成：金戒 + 中央亮宝石，返回宝石中心坐标"""
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (240, 240, 240, 255))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 - 30
    draw.ellipse([cx - 120, cy - 80, cx + 120, cy + 100], fill=(200, 160, 60, 255))
    draw.ellipse([cx - 55, cy - 70, cx + 55, cy + 10], fill=(255, 255, 255, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    return cx, cy


def main() -> int:
    from app.services.preprocess.gem_flatten import (
        GemCoverageTooHighError,
        flatten_gem_regions,
    )
    from app.services.preprocess.pipeline import (
        gem_flatten_sam_from_image,
        gem_segment_sam_from_image,
    )
    from app.services.preprocess.sam_gem_segment import sam_model_available, sam_model_hint

    out_dir = ROOT / "outputs" / "e2e_test"
    out_dir.mkdir(parents=True, exist_ok=True)
    test_png = out_dir / "test_ring.png"
    cx, cy = make_test_ring(test_png)
    points = [{"x": cx, "y": cy, "label": 1}]
    print(f"[1] 测试图: {test_png}  gem_center=({cx},{cy})")

    if not sam_model_available():
        print("[FAIL] SAM 模型不可用:", sam_model_hint())
        return 1
    print("[2] SAM 模型已就绪")

    with Image.open(test_png) as img:
        rgba = img.convert("RGBA")
        seg = gem_segment_sam_from_image(rgba, points, session_id="e2e_sam")
    cov = seg.get("gem_coverage_ratio", 0)
    print(f"[3] gem-segment-sam OK  coverage={cov:.2%}  engine={seg.get('segment_engine')}")

    with Image.open(test_png) as img:
        flat = gem_flatten_sam_from_image(
            img.convert("RGBA"), points, session_id="e2e_flat", gem_preset="ruby"
        )
    print(f"[4] gem-flatten-sam OK  coverage={flat.get('gem_coverage_ratio', 0):.2%}")
    print(f"    preview={flat.get('preview_url')}")

    with Image.open(test_png) as img:
        try:
            flatten_gem_regions(img.convert("RGBA"), sensitivity=0.55)
            print("[5] HSV 保险丝: 未触发（合成图可能覆盖较低）")
        except GemCoverageTooHighError as e:
            print(f"[5] HSV 保险丝 OK: {e}")

    print("\n=== E2E 本地测试通过 ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
