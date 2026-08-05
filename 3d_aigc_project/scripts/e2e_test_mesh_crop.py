#!/usr/bin/env python3
"""
镶嵌网格裁剪 E2E 冒烟测试（需 business-service + ai-service 运行）

用法:
  python scripts/e2e_test_mesh_crop.py --business http://localhost:8854 --mesh path/to/test.obj
"""

from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

import requests


def main() -> int:
    parser = argparse.ArgumentParser(description="Mesh crop API smoke test")
    parser.add_argument("--business", default="http://localhost:8854")
    parser.add_argument("--mesh", required=True, help="OBJ/GLB/STL 测试文件")
    args = parser.parse_args()

    mesh_path = Path(args.mesh)
    if not mesh_path.is_file():
        print(f"ERROR: mesh not found: {mesh_path}")
        return 1

    base = args.business.rstrip("/")
    ext = mesh_path.suffix.lower()

    print("1) 创建镶嵌条目 …")
    with mesh_path.open("rb") as f:
        files = {"source": (mesh_path.name, f, "application/octet-stream")}
        r = requests.post(f"{base}/api/inlay/v2/items", files=files, timeout=120)
    if r.status_code != 200:
        print(f"ERROR create item: {r.status_code} {r.text[:500]}")
        return 1
    body = r.json()
    item_id = body.get("data", {}).get("id")
    if not item_id:
        print(f"ERROR no item id: {body}")
        return 1
    print(f"   item_id={item_id}")

    print("2) split-components …")
    r = requests.post(f"{base}/api/mesh/edit/inlay/{item_id}/split-components", timeout=120)
    if r.status_code != 200:
        print(f"ERROR split: {r.status_code} {r.text[:500]}")
        return 1
    comps = r.json().get("data", {}).get("components", [])
    print(f"   components={len(comps)}")
    if not comps:
        print("WARN: no components returned")

    keep = [c["index"] for c in comps[: max(1, len(comps) // 2)]] or [0]
    print(f"3) crop-and-save keep={keep} …")
    r = requests.post(
        f"{base}/api/mesh/edit/inlay/{item_id}/crop-and-save",
        params={"keep_indices": ",".join(str(i) for i in keep), "output_format": ext.lstrip(".") or "glb"},
        timeout=180,
    )
    if r.status_code != 200:
        print(f"ERROR crop: {r.status_code} {r.text[:500]}")
        return 1

    print("4) GET mesh …")
    r = requests.get(f"{base}/api/inlay/v2/items/{item_id}/mesh", timeout=60)
    if r.status_code != 200:
        print(f"ERROR get mesh: {r.status_code}")
        return 1
    print(f"   mesh bytes={len(r.content)}")

    print("OK mesh crop pipeline passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
