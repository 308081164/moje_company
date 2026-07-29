#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
镶嵌库预览/mesh 批处理 Worker：轮询 business-service v2 任务队列。
所有读写经 API + 对象存储，不依赖「镶嵌结构数据库/」文件夹。

用法：
  python scripts/inlay_worker.py --api http://localhost:8854 --once
  python scripts/inlay_worker.py --api http://localhost:8854 --loop
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import convert_all_inlays as orchestrator  # noqa: E402


def api_post_json(api_base: str, path: str, body: dict | None = None) -> dict:
    url = f"{api_base.rstrip('/')}{path}"
    data = json.dumps(body or {}).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.loads(resp.read().decode("utf-8"))


def api_get(api_base: str, path: str) -> dict:
    url = f"{api_base.rstrip('/')}{path}"
    with urllib.request.urlopen(url, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download_source_jcd(api_base: str, inlay_id: str, dest: Path) -> None:
    url = f"{api_base.rstrip('/')}/api/inlay/v2/items/{inlay_id}/source-jcd"
    with urllib.request.urlopen(url, timeout=120) as resp:
        dest.write_bytes(resp.read())


def upload_mesh(api_base: str, inlay_id: str, obj_path: Path, mesh_method: str, mesh_is_proxy: bool) -> None:
    boundary = "----InlayWorkerBoundary7MA4YWxk"
    body = bytearray()
    crlf = b"\r\n"

    def add_field(name: str, value: str) -> None:
        body.extend(f"--{boundary}{crlf.decode()}".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"{crlf.decode()}'.encode())
        body.extend(crlf)
        body.extend(value.encode())
        body.extend(crlf)

    def add_file(name: str, filename: str, content: bytes, content_type: str) -> None:
        body.extend(f"--{boundary}{crlf.decode()}".encode())
        body.extend(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"{crlf.decode()}'.encode()
        )
        body.extend(f"Content-Type: {content_type}{crlf.decode()}".encode())
        body.extend(crlf)
        body.extend(content)
        body.extend(crlf)

    obj_bytes = obj_path.read_bytes()
    add_field("mesh_method", mesh_method)
    add_field("mesh_is_proxy", "true" if mesh_is_proxy else "false")
    add_file("file", obj_path.name, obj_bytes, "model/obj")
    body.extend(f"--{boundary}--{crlf.decode()}".encode())

    url = f"{api_base.rstrip('/')}/api/inlay/v2/items/{inlay_id}/mesh"
    req = urllib.request.Request(url, data=bytes(body), method="PUT")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(req, timeout=600) as resp:
        resp.read()


def process_job(api_base: str, job: dict) -> tuple[bool, str]:
    inlay_id = job.get("inlayId") or job.get("inlay_id")
    job_type = job.get("jobType") or job.get("job_type", "preview")

    try:
        if job_type == "mesh":
            import convert_jcd_to_mesh as mesh_conv

            with tempfile.TemporaryDirectory(prefix="inlay_worker_") as td:
                td_path = Path(td)
                jcd_path = td_path / "source.jcd"
                download_source_jcd(api_base, inlay_id, jcd_path)
                rec = mesh_conv.convert_one(jcd_path, force=True, dry_run=False, allow_proxy=False)
                ok = rec.get("status") == "ok" and not rec.get("mesh_is_proxy")
                err = rec.get("error") or ("proxy mesh rejected" if rec.get("mesh_is_proxy") else "")
                if ok:
                    obj_path = jcd_path.with_suffix(".obj")
                    upload_mesh(
                        api_base,
                        inlay_id,
                        obj_path,
                        str(rec.get("method", "pointcloud_poisson")),
                        bool(rec.get("mesh_is_proxy")),
                    )
                return ok, err
        else:
            with tempfile.TemporaryDirectory(prefix="inlay_worker_") as td:
                td_path = Path(td)
                jcd_path = td_path / "source.jcd"
                download_source_jcd(api_base, inlay_id, jcd_path)
                rec = orchestrator.refresh_preview_full(jcd_path, force=True)
                ok = rec.get("status") == "ok"
                return ok, rec.get("error", "preview regen needs storage upload API")
    except Exception as exc:
        return False, str(exc)


def run_once(api_base: str) -> bool:
    resp = api_post_json(api_base, "/api/inlay/v2/jobs/claim")
    job = resp.get("data")
    if not job:
        print("no pending jobs")
        return False

    print(f"processing job {job.get('id')} type={job.get('jobType')} inlay={job.get('inlayId')}")
    ok, err = process_job(api_base, job)
    api_post_json(api_base, f"/api/inlay/v2/jobs/{job['id']}/complete", {"success": ok, "error": err or None})
    print(f"  -> {'ok' if ok else 'fail'}: {err}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8854")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=float, default=5.0)
    args = parser.parse_args()

    if args.loop:
        while True:
            try:
                run_once(args.api)
            except urllib.error.URLError as e:
                print(f"API error: {e}")
            time.sleep(args.interval)
    else:
        run_once(args.api)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
