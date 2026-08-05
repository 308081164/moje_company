"""aigc task 命令。"""

from __future__ import annotations

import argparse
import json

from cli.client import AigcClient


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    p = subparsers.add_parser("task", help="任务 status / result / cancel")
    p.add_argument("action", choices=["status", "result", "cancel", "wait"])
    p.add_argument("task_id")
    p.add_argument("--base-url", default="http://localhost:8855")
    p.add_argument("--via-business", action="store_true")
    p.set_defaults(handler=run)


def run(args: argparse.Namespace) -> int:
    client = AigcClient(base_url=args.base_url, via_business=args.via_business)
    if args.action == "status":
        data = client.get_status(args.task_id)
    elif args.action == "result":
        data = client.get_result(args.task_id)
    elif args.action == "cancel":
        data = client.cancel_task(args.task_id)
    else:
        data = client.wait_task(args.task_id)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0
