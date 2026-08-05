"""aigc CLI 入口。"""

from __future__ import annotations

import argparse
import sys

from cli.commands import batch, debug, generate, task


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="aigc", description="3D AIGC 训练/批处理 CLI")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8855",
        help="API 基址（默认 ai-service :8855）",
    )
    parser.add_argument(
        "--via-business",
        action="store_true",
        help="经 business-service (:8854) 提交（任务入库）",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    generate.add_parser(sub)
    batch.add_parser(sub)
    task.add_parser(sub)
    debug.add_parser(sub)
    return parser


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    parser = build_parser()
    args = parser.parse_args(argv)
    if hasattr(args, "base_url") and args.base_url == "http://localhost:8855":
        if getattr(args, "via_business", False):
            args.base_url = "http://localhost:8854"
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.print_help()
        return 1
    return int(handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
