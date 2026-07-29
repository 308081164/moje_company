#!/usr/bin/env python3
"""
并发提交 smoke test：同时向 ai-service 提交 N 个 image-to-3d 任务，
验证不再出现 scheduler index out of bounds 等并发崩溃。

用法（服务已启动且 GPU 可用）:
  python ai-service/scripts/test_concurrent_submit.py --base-url http://localhost:8855 --count 3

依赖: requests, 一张测试 PNG（默认 outputs/e2e_test/test_ring.png）
"""

from __future__ import annotations

import argparse
import concurrent.futures
import sys
import time
import uuid
from pathlib import Path

try:
    import requests
except ImportError:
    print("请安装 requests: pip install requests", file=sys.stderr)
    sys.exit(1)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_IMAGE = PROJECT_ROOT / "ai-service" / "outputs" / "e2e_test" / "test_ring.png"


def submit_one(base_url: str, image_path: str, index: int) -> dict:
    task_id = str(uuid.uuid4())
    body = {
        "task_id": task_id,
        "image_path": str(image_path),
        "result_format": "glb",
        "generation_mode": "fast",
    }
    t0 = time.time()
    r = requests.post(f"{base_url}/api/generate/image-to-3d", json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    return {
        "index": index,
        "task_id": task_id,
        "submit_ms": round((time.time() - t0) * 1000),
        "status": data.get("status"),
    }


def poll_until_done(base_url: str, task_id: str, timeout: float = 900) -> dict:
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        r = requests.get(f"{base_url}/api/generate/status/{task_id}", timeout=15)
        r.raise_for_status()
        last = r.json()
        status = last.get("status")
        if status in ("completed", "failed", "cancelled"):
            return last
        time.sleep(3)
    raise TimeoutError(f"任务 {task_id} 超时")


def main() -> int:
    parser = argparse.ArgumentParser(description="并发提交 ai-service 任务")
    parser.add_argument("--base-url", default="http://localhost:8855")
    parser.add_argument("--count", type=int, default=3)
    parser.add_argument("--image", type=Path, default=DEFAULT_IMAGE)
    parser.add_argument("--parallel-submit", type=int, default=0, help="0=全部同时提交")
    args = parser.parse_args()

    if not args.image.is_file():
        print(f"测试图不存在: {args.image}", file=sys.stderr)
        return 1

    health = requests.get(f"{args.base_url}/health", timeout=10).json()
    print("health:", health)
    if not health.get("gpu_available"):
        print("WARN: gpu_available=false，测试可能无意义", file=sys.stderr)

    print(f"并发提交 {args.count} 个任务...")
    submitted = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.count) as pool:
        futs = [
            pool.submit(submit_one, args.base_url, args.image, i)
            for i in range(args.count)
        ]
        for fut in concurrent.futures.as_completed(futs):
            submitted.append(fut.result())
            print("  submitted:", submitted[-1])

    print("等待全部完成...")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.count) as pool:
        futs = [
            pool.submit(poll_until_done, args.base_url, s["task_id"])
            for s in submitted
        ]
        for fut in concurrent.futures.as_completed(futs):
            results.append(fut.result())

    failed = [r for r in results if r.get("status") == "failed"]
    completed = [r for r in results if r.get("status") == "completed"]
    print(f"\n完成: {len(completed)}/{len(results)}, 失败: {len(failed)}")
    for r in results:
        print(
            f"  {r.get('task_id')[:8]}... status={r.get('status')} "
            f"error={r.get('error') or '-'}"
        )

    final_health = requests.get(f"{args.base_url}/health", timeout=10).json()
    print("\nfinal health:", final_health)

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
