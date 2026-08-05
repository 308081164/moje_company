"""aigc debug 命令。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from cli.client import AigcClient


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("debug", help="调试流水线")
    sub = p.add_subparsers(dest="debug_cmd", required=True)

    step = sub.add_parser("step", help="直接执行单步")
    step.add_argument("step_id")
    step.add_argument("--raw-mesh", required=True)
    step.add_argument("--inlay", required=True, dest="inlay_mesh")
    step.add_argument("--output-dir", help="仅打印结果路径提示")
    step.add_argument("--force", action="store_true")
    step.add_argument("--base-url", default="http://localhost:8855")
    step.add_argument("--via-business", action="store_true")
    step.set_defaults(handler=run_step)

    health = sub.add_parser("health", help="检查服务健康")
    health.add_argument("--base-url", default="http://localhost:8855")
    health.set_defaults(handler=run_health)


def run_step(args: argparse.Namespace) -> int:
    client = AigcClient(base_url=args.base_url, via_business=args.via_business)
    raw = str(Path(args.raw_mesh).expanduser().resolve())
    inlay = str(Path(args.inlay_mesh).expanduser().resolve())
    result = client.run_debug_step_direct(args.step_id, raw, inlay, force=args.force)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.output_dir:
        out = Path(args.output_dir).expanduser().resolve()
        out.mkdir(parents=True, exist_ok=True)
        print(f"步骤输出目录见 result.output_dir → {result.get('output_dir', out)}")
    return 0 if result.get("success") else 1


def run_health(args: argparse.Namespace) -> int:
    client = AigcClient(base_url=args.base_url)
    print(json.dumps(client.health(), ensure_ascii=False, indent=2))
    return 0
