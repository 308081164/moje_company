"""GPU 生成冒烟测试：fast 模式单图 -> STL。"""
import json
import sys
import time
import urllib.error
import urllib.request

from PIL import Image


def main() -> int:
    task_id = sys.argv[1] if len(sys.argv) > 1 else None
    if not task_id:
        image_path = "/app/uploads/smoke_test.png"
        Image.new("RGB", (512, 512), (200, 180, 160)).save(image_path)
        body = json.dumps(
            {
                "image_path": image_path,
                "generation_mode": "fast",
                "result_format": "stl",
                "prompt": "simple ring band",
            }
        ).encode()
        req = urllib.request.Request(
            "http://127.0.0.1:8855/api/generate/image-to-3d",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        task_id = data["task_id"]
        print("submitted", task_id)

    for i in range(180):
        time.sleep(5)
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:8855/api/generate/status/{task_id}", timeout=30
            ) as resp:
                st = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            print("poll error", exc)
            continue
        status = st.get("status")
        print(
            f"[{i * 5}s] status={status} progress={st.get('progress')} "
            f"step={st.get('current_step')} err={st.get('error')}"
        )
        if status in ("completed", "failed", "cancelled"):
            print("FINAL", json.dumps(st, ensure_ascii=False))
            return 0 if status == "completed" else 1
    print("timeout")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
