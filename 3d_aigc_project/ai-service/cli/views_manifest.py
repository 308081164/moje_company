"""六视角 manifest 解析（front|back|left|right|top|bottom）。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

VIEW_KEYS = ("front", "back", "left", "right", "top", "bottom")


def parse_view_arg(spec: str) -> tuple[str, str]:
    """解析 --view front=path.png"""
    if "=" not in spec:
        raise ValueError(f"视角参数格式应为 key=path，收到: {spec}")
    key, path = spec.split("=", 1)
    key = key.strip().lower()
    if key not in VIEW_KEYS:
        raise ValueError(f"未知视角键 {key!r}，允许: {', '.join(VIEW_KEYS)}")
    return key, path.strip()


def collect_views(view_args: Optional[List[str]]) -> Dict[str, str]:
    views: Dict[str, str] = {}
    for spec in view_args or []:
        key, path = parse_view_arg(spec)
        views[key] = str(Path(path).expanduser().resolve())
    return views


def iter_jsonl_manifest(path: str) -> Iterator[Dict[str, Any]]:
    p = Path(path).expanduser()
    with p.open("r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            try:
                row = json.loads(text)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{p}:{line_no} JSON 解析失败: {exc}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"{p}:{line_no} 每行须为 JSON object")
            yield row


def normalize_job_views(job: Dict[str, Any]) -> Dict[str, str]:
    views = job.get("views") or {}
    if not isinstance(views, dict):
        raise ValueError("job.views 须为 object")
    out: Dict[str, str] = {}
    for key, path in views.items():
        k = str(key).lower()
        if k not in VIEW_KEYS:
            raise ValueError(f"未知视角键 {k!r}")
        out[k] = str(Path(str(path)).expanduser().resolve())
    if len(out) < 2:
        raise ValueError("多视图 job 至少需要 2 个视角")
    return out
