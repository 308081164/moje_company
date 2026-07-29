"""
GPU 推理队列 — 串行化所有 CUDA / Hunyuan3D 可变状态操作。

Hunyuan3D ShapeGen 的 scheduler 含可变 step_index，非线程安全；同时
model_manager 在推理期间切换/卸载 shape_gen 会导致并发任务崩溃。
本模块用 threading.RLock 保证同一时刻仅一个任务占用 GPU 推理槽位，
并提供队列指标与瞬态错误重试。
"""

from __future__ import annotations

import logging
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# 覆盖：ShapeGen 推理、TexGen 推理、load_model、MV/SV 模型切换
_GPU_INFERENCE_LOCK = threading.RLock()

# 瞬态失败特征（可安全重试一次）
_TRANSIENT_ERROR_MARKERS = (
    "index",
    "out of bounds",
    "cuda out of memory",
    "cudnnc",
    "device-side assert",
    "an illegal memory access",
    "runtimeerror: cuda",
)


@dataclass
class _GpuQueueState:
    waiting: int = 0
    active_task_id: Optional[str] = None
    active_since: Optional[float] = None
    total_jobs: int = 0
    max_gpu_jobs: int = 1


_state = _GpuQueueState()
_state_lock = threading.Lock()


def configure_max_gpu_jobs(max_jobs: int) -> None:
    """启动时设置允许的最大并发 GPU 任务数（当前实现仅支持 1）。"""
    capped = max(1, int(max_jobs))
    if capped > 1:
        logger.warning(
            "MAX_CONCURRENT_GPU_JOBS=%d 已请求，但 Hunyuan3D pipeline 非线程安全；"
            "实际 GPU 并发仍强制为 1。",
            capped,
        )
    with _state_lock:
        _state.max_gpu_jobs = 1  # 硬件/模型限制：仅 1


def get_gpu_queue_stats() -> Dict[str, Any]:
    """返回 GPU 队列快照（供 /health 与日志使用）。"""
    with _state_lock:
        active_for = None
        if _state.active_since is not None:
            active_for = round(time.time() - _state.active_since, 2)
        return {
            "waiting": _state.waiting,
            "active_task_id": _state.active_task_id,
            "active_for_seconds": active_for,
            "total_jobs": _state.total_jobs,
            "max_gpu_jobs": _state.max_gpu_jobs,
        }


def is_gpu_busy() -> bool:
    """是否有任务正在占用或等待 GPU 推理槽位。"""
    stats = get_gpu_queue_stats()
    return bool(stats["active_task_id"]) or stats["waiting"] > 0


def is_transient_inference_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return any(marker in msg for marker in _TRANSIENT_ERROR_MARKERS)


def run_with_retry(
    fn: Callable[[], T],
    *,
    task_id: str,
    max_attempts: int = 2,
    backoff_seconds: float = 1.5,
) -> T:
    """在已持有 GPU 锁的上下文中执行 fn，对瞬态 CUDA/scheduler 错误重试。"""
    last_exc: Optional[BaseException] = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt >= max_attempts or not is_transient_inference_error(exc):
                raise
            logger.warning(
                "任务 %s GPU 推理瞬态失败 (%d/%d): %s — 将在 %.1fs 后重试",
                task_id,
                attempt,
                max_attempts,
                exc,
                backoff_seconds * attempt,
            )
            time.sleep(backoff_seconds * attempt)
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
    assert last_exc is not None
    raise last_exc


@contextmanager
def gpu_inference_slot(
    task_id: str,
    on_active: Optional[Callable[[], None]] = None,
):
    """
    阻塞直至获得 GPU 推理槽位。必须在 asyncio.to_thread 中调用，
    避免阻塞事件循环。
    """
    with _state_lock:
        _state.waiting += 1
        queue_ahead = _state.waiting - 1 + (1 if _state.active_task_id else 0)

    logger.info(
        "任务 %s 进入 GPU 推理队列（前方约 %d 个）",
        task_id,
        queue_ahead,
    )
    try:
        _GPU_INFERENCE_LOCK.acquire()
        with _state_lock:
            _state.waiting = max(0, _state.waiting - 1)
            _state.active_task_id = task_id
            _state.active_since = time.time()
            _state.total_jobs += 1
        logger.info("任务 %s 获得 GPU 推理槽位", task_id)
        if on_active is not None:
            try:
                on_active()
            except Exception as exc:
                logger.warning("任务 %s on_active 回调失败: %s", task_id, exc)
        try:
            yield
        finally:
            with _state_lock:
                _state.active_task_id = None
                _state.active_since = None
            _GPU_INFERENCE_LOCK.release()
            logger.info("任务 %s 释放 GPU 推理槽位", task_id)
    except Exception:
        with _state_lock:
            _state.waiting = max(0, _state.waiting - 1)
        raise


def run_in_gpu_slot(
    task_id: str,
    fn: Callable[[], T],
    *,
    on_active: Optional[Callable[[], None]] = None,
    retry: bool = True,
) -> T:
    """同步：排队 → 持锁 → 执行（可选重试）。"""
    with gpu_inference_slot(task_id, on_active=on_active):
        if retry:
            return run_with_retry(fn, task_id=task_id)
        return fn()
