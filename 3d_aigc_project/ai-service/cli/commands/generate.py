"""aigc generate 命令。"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from cli.client import AigcClient
from cli.views_manifest import collect_views


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("generate", help="单任务图片→3D 生成")
    p.add_argument("--mode", default="quality", choices=["fast", "quality", "custom"])
    p.add_argument("--view", action="append", default=[], help="视角 front=path（可重复）")
    p.add_argument("--image", help="单图路径（非多视图时）")
    p.add_argument("--setting-mesh", help="镶嵌底座 mesh 路径")
    p.add_argument("--format", default="stl", dest="result_format")
    p.add_argument("--output-dir", required=True, help="输出目录")
    p.add_argument("--task-id", help="指定 task_id")
    p.add_argument("--target-faces", type=int, help="custom 模式目标面数")
    p.add_argument("--octree", type=int, help="custom octree 分辨率")
    p.add_argument("--steps", type=int, help="custom 推理步数")
    p.add_argument("--enable-inlay-postprocess", action="store_true")
    p.add_argument("--wait", action="store_true", help="等待任务完成")
    p.add_argument("--base-url", default="http://localhost:8855")
    p.add_argument("--via-business", action="store_true")
    p.set_defaults(handler=run)


def _copy_outputs(task_id: str, result: Dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"task_id": task_id, "result": result}
    files = result.get("result_files") or []
    main_path = result.get("result_url") or result.get("output_path")
    copied: List[str] = []
    for src in files:
        if not src:
            continue
        sp = Path(src)
        if sp.is_file():
            dest = output_dir / sp.name
            shutil.copy2(sp, dest)
            copied.append(str(dest))
    if main_path:
        mp = Path(main_path)
        if mp.is_file() and str(mp) not in files:
            dest = output_dir / mp.name
            shutil.copy2(mp, dest)
            copied.append(str(dest))
    manifest["copied_files"] = copied
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def run(args: argparse.Namespace) -> int:
    client = AigcClient(base_url=args.base_url, via_business=args.via_business)
    views = collect_views(args.view)
    task_id = args.task_id or client.new_task_id()

    payload: Dict[str, Any] = {
        "task_id": task_id,
        "result_format": args.result_format,
        "generation_mode": args.mode,
        "enable_inlay_postprocess": bool(args.enable_inlay_postprocess),
    }
    if views:
        payload["multi_view"] = True
        payload["views"] = views
        payload["image_path"] = views.get("front") or next(iter(views.values()))
    elif args.image:
        payload["image_path"] = str(Path(args.image).expanduser().resolve())
    else:
        raise SystemExit("请提供 --view 或 --image")

    if args.setting_mesh:
        payload["setting_mesh_path"] = str(Path(args.setting_mesh).expanduser().resolve())

    if args.mode == "custom":
        if args.target_faces is not None:
            payload["custom_target_faces"] = args.target_faces
        if args.octree is not None:
            payload["custom_octree_resolution"] = args.octree
        if args.steps is not None:
            payload["custom_inference_steps"] = args.steps

    print(f"提交任务 {task_id} → {client.base_url}")
    client.submit_generate(payload)

    if not args.wait:
        print(json.dumps({"task_id": task_id}, ensure_ascii=False))
        return 0

    status = client.wait_task(task_id)
    print(json.dumps(status, ensure_ascii=False, indent=2))
    if status.get("status") != "completed":
        return 1

    result = client.get_result(task_id)
    out_dir = Path(args.output_dir).expanduser().resolve()
    _copy_outputs(task_id, result, out_dir)
    print(f"已写入 {out_dir}")
    return 0
