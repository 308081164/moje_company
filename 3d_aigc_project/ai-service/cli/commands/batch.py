"""aigc batch 命令。"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict

from cli.client import AigcClient
from cli.commands.generate import _copy_outputs
from cli.views_manifest import iter_jsonl_manifest, normalize_job_views


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("batch", help="JSONL manifest 批处理")
    p.add_argument("--manifest", required=True, help="jobs.jsonl 路径")
    p.add_argument("--output-root", required=True, help="批处理输出根目录")
    p.add_argument("--workers", type=int, default=4, help="并发提交+轮询数（非 GPU 并行）")
    p.add_argument("--base-url", default="http://localhost:8855")
    p.add_argument("--via-business", action="store_true")
    p.add_argument("--wait", action="store_true", default=True)
    p.set_defaults(handler=run)


def _run_one_job(client: AigcClient, job: Dict[str, Any], output_root: Path) -> Dict[str, Any]:
    sample_id = str(job.get("sample_id") or job.get("id") or client.new_task_id("batch"))
    mode = str(job.get("mode") or job.get("generation_mode") or "quality")
    result_format = str(job.get("format") or job.get("result_format") or "stl")
    views = normalize_job_views(job)
    task_id = str(job.get("task_id") or client.new_task_id(sample_id))

    payload: Dict[str, Any] = {
        "task_id": task_id,
        "multi_view": True,
        "views": views,
        "image_path": views.get("front") or next(iter(views.values())),
        "result_format": result_format,
        "generation_mode": mode,
        "enable_inlay_postprocess": bool(job.get("enable_inlay_postprocess")),
    }
    if job.get("setting_mesh_path"):
        payload["setting_mesh_path"] = str(Path(job["setting_mesh_path"]).expanduser().resolve())
    if mode == "custom" and job.get("custom_target_faces") is not None:
        payload["custom_target_faces"] = int(job["custom_target_faces"])

    client.submit_generate(payload)
    status = client.wait_task(task_id)
    if status.get("status") != "completed":
        return {"sample_id": sample_id, "task_id": task_id, "status": status.get("status"), "ok": False}

    result = client.get_result(task_id)
    out_dir = output_root / sample_id
    _copy_outputs(task_id, result, out_dir)
    return {"sample_id": sample_id, "task_id": task_id, "output_dir": str(out_dir), "ok": True}


def run(args: argparse.Namespace) -> int:
    client = AigcClient(base_url=args.base_url, via_business=args.via_business)
    jobs = list(iter_jsonl_manifest(args.manifest))
    if not jobs:
        print("manifest 为空")
        return 1

    output_root = Path(args.output_root).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    results = []
    workers = max(1, args.workers)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_run_one_job, client, job, output_root): job
            for job in jobs
        }
        for fut in as_completed(futures):
            row = fut.result()
            results.append(row)
            print(json.dumps(row, ensure_ascii=False))

    ok = sum(1 for r in results if r.get("ok"))
    print(f"完成 {ok}/{len(results)}")
    summary_path = output_root / "batch_summary.json"
    summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if ok == len(results) else 1
