"""
后处理线程池 — 与 GPU 推理队列分离，并行 mesh 融合 / 清洗 / 格式转换等 CPU 任务。
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

_executor: Optional[ThreadPoolExecutor] = None
_lock = threading.Lock()
_max_workers: int = 4
_active_jobs: int = 0
_queued_jobs: int = 0


def configure_postprocess_workers(max_workers: int) -> None:
    global _executor, _max_workers
    capped = max(1, min(16, int(max_workers)))
    with _lock:
        _max_workers = capped
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=False)
            _executor = None
    logger.info("后处理线程池配置: max_workers=%d", capped)


def _ensure_executor() -> ThreadPoolExecutor:
    global _executor
    with _lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=_max_workers,
                thread_name_prefix="postprocess",
            )
        return _executor


def get_postprocess_stats() -> Dict[str, Any]:
    with _lock:
        return {
            "max_workers": _max_workers,
            "active_jobs": _active_jobs,
            "queued_jobs": _queued_jobs,
        }


def submit_postprocess(fn: Callable[[], T]) -> Future[T]:
    """提交后处理任务到线程池。"""
    global _active_jobs, _queued_jobs

    def _wrapped() -> T:
        global _active_jobs, _queued_jobs
        with _lock:
            _queued_jobs = max(0, _queued_jobs - 1)
            _active_jobs += 1
        try:
            return fn()
        finally:
            with _lock:
                _active_jobs = max(0, _active_jobs - 1)

    with _lock:
        _queued_jobs += 1
    return _ensure_executor().submit(_wrapped)


def run_postprocess_sync(fn: Callable[[], T]) -> T:
    """同步执行后处理（当前线程，供 debug 等低并发路径）。"""
    return fn()
