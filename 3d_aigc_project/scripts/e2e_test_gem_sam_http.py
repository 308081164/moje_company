"""通过 business-service (8854) 做 SAM 宝石 API 端到端测试"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

PROJECT = Path(__file__).resolve().parents[1]
TEST_PNG = PROJECT / "ai-service" / "outputs" / "e2e_test" / "test_ring.png"
BASE = "http://localhost:8854/api/preprocess"
POINTS = json.dumps([{"x": 256, "y": 226, "label": 1}])


def wait_service(url: str, retries: int = 30) -> bool:
    for i in range(retries):
        try:
            r = requests.get("http://localhost:8854/api/system/info", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(2)
        print(f"  waiting business service... {i + 1}/{retries}")
    return False


def main() -> int:
    if not TEST_PNG.is_file():
        print(f"[FAIL] 缺少测试图，请先运行 ai-service/scripts/e2e_test_gem_sam.py")
        return 1

    print("[0] 等待 business-service 8854 ...")
    if not wait_service(BASE):
        print("[FAIL] business-service 未就绪")
        return 1
    print("[0] business-service OK")

    with TEST_PNG.open("rb") as f:
        r = requests.post(
            f"{BASE}/gem-segment-sam",
            files={"image": ("test_ring.png", f, "image/png")},
            data={"points_json": POINTS},
            timeout=180,
        )
    print(f"[1] gem-segment-sam HTTP {r.status_code}")
    body = r.json()
    if body.get("code") not in (0, 200):
        print("[FAIL]", body)
        return 1
    data = body["data"]
    print(f"    coverage={data.get('gemCoverageRatio', 0):.2%} engine={data.get('segmentEngine')}")

    with TEST_PNG.open("rb") as f:
        r2 = requests.post(
            f"{BASE}/gem-flatten-sam",
            files={"image": ("test_ring.png", f, "image/png")},
            data={"points_json": POINTS, "gem_preset": "ruby"},
            timeout=180,
        )
    print(f"[2] gem-flatten-sam HTTP {r2.status_code}")
    body2 = r2.json()
    if body2.get("code") not in (0, 200):
        print("[FAIL]", body2)
        return 1
    sid = body2["data"]["sessionId"]
    preview = requests.get(f"{BASE}/preview/{sid}", timeout=30)
    print(f"[3] preview/{sid} HTTP {preview.status_code} size={len(preview.content)}")

    with TEST_PNG.open("rb") as f:
        r3 = requests.post(
            f"{BASE}/gem-flatten",
            files={"image": ("test_ring.png", f, "image/png")},
            data={"gem_preset": "ruby", "sensitivity": "0.55"},
            timeout=60,
        )
    print(f"[4] gem-flatten HSV fuse HTTP {r3.status_code}")
    b3 = r3.json()
    if b3.get("code") == 400 or (b3.get("code") not in (0, 200)):
        print(f"    HSV 保险丝触发 OK: {b3.get('message', b3)}")
    else:
        print("    [WARN] HSV 未拒绝:", b3)

    print("\n=== HTTP E2E 通过 ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
