"""
Debug pipeline session manager — step-by-step alignment / fusion debugging.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import uuid
import glob
from datetime import datetime
from enum import Enum
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

from app.config import get_config
from app.services.debug_pipeline_steps import (
    DEBUG_STEP_IDS,
    STEP_DEFINITIONS,
    DebugPipelineContext,
    run_debug_step,
)
from app.services.mesh_processor import get_mesh_processor

logger = logging.getLogger(__name__)


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_CONFIRM = "awaiting_confirm"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class DebugSession:
    def __init__(
        self,
        session_id: str,
        source_task_id: str,
        output_dir: str,
        ctx: DebugPipelineContext,
    ):
        self.session_id = session_id
        self.source_task_id = source_task_id
        self.output_dir = output_dir
        self.ctx = ctx
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.current_step_index = 0
        self.step_states: Dict[str, Dict[str, Any]] = {
            sid: {"status": StepStatus.PENDING.value, "result": None}
            for sid in DEBUG_STEP_IDS
        }

    def to_dict(self) -> Dict[str, Any]:
        steps = []
        for i, defn in enumerate(STEP_DEFINITIONS):
            sid = defn["id"]
            st = self.step_states.get(sid, {})
            steps.append(
                {
                    **defn,
                    "index": i,
                    "status": st.get("status", StepStatus.PENDING.value),
                    "result": st.get("result"),
                    "unlocked": i <= self.current_step_index,
                    "is_current": i == self.current_step_index,
                }
            )
        return {
            "session_id": self.session_id,
            "source_task_id": self.source_task_id,
            "output_dir": self.output_dir,
            "current_step_index": self.current_step_index,
            "current_step_id": DEBUG_STEP_IDS[self.current_step_index]
            if self.current_step_index < len(DEBUG_STEP_IDS)
            else None,
            "completed": self.current_step_index >= len(DEBUG_STEP_IDS),
            "steps": steps,
            "step_definitions": STEP_DEFINITIONS,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


def _session_state_path(output_dir: str) -> str:
    return os.path.join(output_dir, "debug_session.json")


def _is_file(path: Optional[str]) -> bool:
    return bool(path) and os.path.isfile(path)


def _default_preview_mode(step_id: str) -> str:
    if step_id in ("ai_part_split", "ai_inlay_detect", "colored_merge"):
        return "colored"
    return "white"


def _cad_reverse_preview_path(ctx: DebugPipelineContext) -> Optional[str]:
    from app.utils.file_utils import generate_output_path

    preview = generate_output_path(
        ctx.output_dir, ctx.session_id, "debug_preview_ai_cad_reverse.glb"
    )
    if _is_file(preview):
        return preview
    return ctx.cleaned_ai_path or ctx.current_ai_path or ctx.raw_mesh_path


def _preview_path_from_ctx(ctx: DebugPipelineContext, step_id: str) -> Optional[str]:
    mapping = {
        "prepare": ctx.raw_mesh_path,
        "inlay_sanitize": ctx.cleaned_inlay_path,
        "ai_sanitize": ctx.cleaned_ai_path,
        "ai_cad_reverse": _cad_reverse_preview_path(ctx),
        "ai_part_split": ctx.ai_part_split_path,
        "ai_inlay_detect": ctx.ai_inlay_detect_path,
        "size_align": ctx.size_aligned_mesh_path,
        "align_coarse": ctx.aligned_mesh_path,
        "align_icp": ctx.aligned_mesh_path,
        "align_refine": ctx.aligned_mesh_path,
        "gap_close": ctx.current_ai_path or ctx.aligned_mesh_path,
        "crop": ctx.current_ai_path or ctx.aligned_mesh_path,
        "colored_merge": None,
    }
    path = mapping.get(step_id)
    if step_id == "ai_cad_reverse" and path:
        return path
    if _is_file(path):
        return path
    from app.utils.file_utils import generate_output_path

    guess = generate_output_path(ctx.output_dir, ctx.session_id, f"debug_preview_{step_id}.glb")
    return guess if _is_file(guess) else None


def _step_has_evidence(ctx: DebugPipelineContext, step_id: str) -> bool:
    from app.utils.file_utils import generate_output_path

    if step_id == "prepare":
        preview = generate_output_path(
            ctx.output_dir, ctx.session_id, "debug_preview_prepare.glb"
        )
        return _is_file(preview)
    if step_id == "inlay_sanitize":
        return _is_file(ctx.cleaned_inlay_path)
    if step_id == "ai_sanitize":
        return _is_file(ctx.cleaned_ai_path)
    if step_id == "ai_cad_reverse":
        preview = generate_output_path(
            ctx.output_dir, ctx.session_id, "debug_preview_ai_cad_reverse.glb"
        )
        if _is_file(preview):
            return True
        report = os.path.join(ctx.output_dir, "cad_fit_report.json")
        step_glob = os.path.join(ctx.output_dir, f"{ctx.session_id}_cad*.step")
        return _is_file(report) or bool(glob.glob(step_glob))
    if step_id == "ai_part_split":
        info = ctx.ai_part_split_info or {}
        if info.get("skipped"):
            return True
        return _is_file(ctx.ai_part_split_path)
    if step_id == "ai_inlay_detect":
        return _is_file(ctx.ai_inlay_detect_path)
    if step_id == "size_align":
        return _is_file(ctx.size_aligned_mesh_path)
    if step_id in ("align_coarse", "align_icp", "align_refine"):
        return ctx.transform is not None and _is_file(ctx.aligned_mesh_path)
    if step_id == "gap_close":
        info = ctx.align_info or {}
        return bool(info.get("gap_close_applied")) or _is_file(ctx.current_ai_path)
    if step_id == "crop":
        return ctx.crop_info is not None and _is_file(ctx.current_ai_path)
    if step_id == "colored_merge":
        preview = _preview_path_from_ctx(ctx, step_id)
        return _is_file(preview)
    return False


def _synthetic_step_result(ctx: DebugPipelineContext, step_id: str) -> Dict[str, Any]:
    metrics: Dict[str, Any] = {}
    if step_id == "ai_part_split" and ctx.ai_part_split_info:
        info = ctx.ai_part_split_info
        metrics = {
            "skipped": info.get("skipped"),
            "method": info.get("method"),
            "n_shank": info.get("n_shank"),
            "n_setting": info.get("n_setting"),
        }
    elif step_id == "ai_inlay_detect" and ctx.ai_inlay_detect_info:
        info = ctx.ai_inlay_detect_info
        metrics = {
            "n_detected": info.get("n_detected"),
            "detect_ratio": info.get("detect_ratio"),
            "profile_peak": info.get("profile_peak"),
            "roll_hint_deg": info.get("roll_hint_deg"),
            "detect_method": info.get("detect_method"),
        }
    elif step_id == "size_align" and ctx.size_align_info:
        metrics = dict(ctx.size_align_info)
    return {
        "step_id": step_id,
        "success": True,
        "preview_path": _preview_path_from_ctx(ctx, step_id),
        "preview_mode": _default_preview_mode(step_id),
        "metrics": metrics,
        "artifacts": {},
        "message": "",
    }


def _infer_session_from_context(
    ctx: DebugPipelineContext,
) -> Tuple[int, Dict[str, Dict[str, Any]]]:
    """Rebuild step pointer from persisted pipeline artifacts after service restart."""
    states: Dict[str, Dict[str, Any]] = {
        sid: {"status": StepStatus.PENDING.value, "result": None}
        for sid in DEBUG_STEP_IDS
    }
    last_done = -1
    for i, sid in enumerate(DEBUG_STEP_IDS):
        if _step_has_evidence(ctx, sid):
            last_done = i
        else:
            break

    if last_done < 0:
        return 0, states

    if last_done == len(DEBUG_STEP_IDS) - 1 and _step_has_evidence(ctx, DEBUG_STEP_IDS[-1]):
        for sid in DEBUG_STEP_IDS:
            states[sid] = {
                "status": StepStatus.CONFIRMED.value,
                "result": _synthetic_step_result(ctx, sid),
            }
        return len(DEBUG_STEP_IDS), states

    for i in range(last_done):
        states[DEBUG_STEP_IDS[i]] = {
            "status": StepStatus.CONFIRMED.value,
            "result": _synthetic_step_result(ctx, DEBUG_STEP_IDS[i]),
        }

    current_sid = DEBUG_STEP_IDS[last_done]
    states[current_sid] = {
        "status": StepStatus.AWAITING_CONFIRM.value,
        "result": _synthetic_step_result(ctx, current_sid),
    }
    return last_done, states


class DebugPipelineService:
    def __init__(self):
        self._sessions: Dict[str, DebugSession] = {}
        self._lock = Lock()

    def _normalize_step_states(self, session: DebugSession) -> None:
        for sid in DEBUG_STEP_IDS:
            if sid not in session.step_states:
                session.step_states[sid] = {
                    "status": StepStatus.PENDING.value,
                    "result": None,
                }

    def _persist_session(self, session: DebugSession) -> None:
        path = _session_state_path(session.output_dir)
        payload = {
            "current_step_index": session.current_step_index,
            "step_states": session.step_states,
            "updated_at": session.updated_at.isoformat(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _hydrate_session_state(self, session: DebugSession) -> None:
        path = _session_state_path(session.output_dir)
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            session.current_step_index = int(payload.get("current_step_index", 0))
            loaded_states = payload.get("step_states")
            if isinstance(loaded_states, dict):
                session.step_states = loaded_states
            if payload.get("updated_at"):
                try:
                    session.updated_at = datetime.fromisoformat(payload["updated_at"])
                except ValueError:
                    pass
        else:
            idx, states = _infer_session_from_context(session.ctx)
            session.current_step_index = idx
            session.step_states = states
            self._persist_session(session)
            logger.info(
                "debug session %s restored from context artifacts at step %s",
                session.session_id,
                DEBUG_STEP_IDS[idx] if idx < len(DEBUG_STEP_IDS) else "completed",
            )
        self._normalize_step_states(session)

    def create_session(
        self,
        source_task_id: str,
        raw_mesh_path: str,
        inlay_mesh_path: str,
        *,
        output_format: str = "glb",
        enable_icp: bool = True,
        enable_ai_part_split: bool = False,
        session_id: Optional[str] = None,
    ) -> DebugSession:
        if not os.path.isfile(raw_mesh_path):
            raise FileNotFoundError(
                f"raw_mesh 不存在: {raw_mesh_path}；请先完成一次普通生成或上传 mesh"
            )
        if not os.path.isfile(inlay_mesh_path):
            raise FileNotFoundError(f"镶嵌底座不存在: {inlay_mesh_path}")

        sid = session_id or str(uuid.uuid4())
        cfg = get_config()
        output_dir = os.path.join(cfg.service.output_dir, "debug", sid)
        os.makedirs(output_dir, exist_ok=True)

        ctx = DebugPipelineContext(
            session_id=sid,
            source_task_id=source_task_id or "",
            output_dir=output_dir,
            raw_mesh_path=raw_mesh_path,
            inlay_mesh_path=inlay_mesh_path,
            user_fmt=(output_format or "glb").lower(),
            enable_icp=enable_icp,
            enable_ai_part_split=enable_ai_part_split,
        )
        ctx.save()

        session = DebugSession(sid, source_task_id or "", output_dir, ctx)
        self._persist_session(session)
        with self._lock:
            self._sessions[sid] = session
        logger.info("debug session created: %s source_task=%s", sid, source_task_id or "(standalone)")
        return session

    def create_standalone_session(
        self,
        raw_mesh_path: str,
        inlay_mesh_path: str,
        *,
        output_format: str = "glb",
        enable_icp: bool = True,
        enable_ai_part_split: bool = False,
        session_id: Optional[str] = None,
    ) -> DebugSession:
        """独立调试会话，无需 source_task_id。"""
        return self.create_session(
            source_task_id="",
            raw_mesh_path=raw_mesh_path,
            inlay_mesh_path=inlay_mesh_path,
            output_format=output_format,
            enable_icp=enable_icp,
            enable_ai_part_split=enable_ai_part_split,
            session_id=session_id,
        )

    def run_step_direct(
        self,
        step_id: str,
        raw_mesh_path: str,
        inlay_mesh_path: str,
        *,
        context: Optional[Dict[str, Any]] = None,
        force: bool = False,  # noqa: ARG002 — API 兼容字段
    ) -> Dict[str, Any]:
        """无 session 顺序约束，直接执行单步（供 CLI / 脚本）。"""
        if step_id not in DEBUG_STEP_IDS:
            raise ValueError(f"unknown step: {step_id}")
        if not os.path.isfile(raw_mesh_path):
            raise FileNotFoundError(f"raw_mesh 不存在: {raw_mesh_path}")
        if not os.path.isfile(inlay_mesh_path):
            raise FileNotFoundError(f"镶嵌底座不存在: {inlay_mesh_path}")

        sid = str(uuid.uuid4())
        cfg = get_config()
        output_dir = os.path.join(cfg.service.output_dir, "debug", "direct", sid)
        os.makedirs(output_dir, exist_ok=True)

        ctx = DebugPipelineContext(
            session_id=sid,
            source_task_id="",
            output_dir=output_dir,
            raw_mesh_path=raw_mesh_path,
            inlay_mesh_path=inlay_mesh_path,
            user_fmt="glb",
            enable_icp=True,
            enable_ai_part_split=False,
        )
        if context:
            valid = set(DebugPipelineContext.__dataclass_fields__.keys())
            for key, value in context.items():
                if key in valid and value is not None:
                    setattr(ctx, key, value)
        ctx.save()

        processor = get_mesh_processor()
        result = run_debug_step(processor, ctx, step_id)
        result["session_id"] = sid
        result["output_dir"] = output_dir
        return result

    def get_session(self, session_id: str) -> DebugSession:
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            state_path = os.path.join(
                get_config().service.output_dir, "debug", session_id, "debug_context.json"
            )
            if os.path.isfile(state_path):
                ctx = DebugPipelineContext.load(state_path)
                session = DebugSession(session_id, ctx.source_task_id, ctx.output_dir, ctx)
                self._hydrate_session_state(session)
                with self._lock:
                    self._sessions[session_id] = session
                return session
            raise KeyError(f"debug session not found: {session_id}")
        return session

    def run_step(
        self, session_id: str, step_id: str, *, force: bool = False
    ) -> Dict[str, Any]:
        session = self.get_session(session_id)
        if step_id not in DEBUG_STEP_IDS:
            raise ValueError(f"unknown step: {step_id}")

        step_index = DEBUG_STEP_IDS.index(step_id)
        st = session.step_states[step_id].get("status", StepStatus.PENDING.value)
        if step_index > session.current_step_index:
            raise RuntimeError("请先确认前序步骤后再执行本步")
        if step_index < session.current_step_index and not force:
            if st == StepStatus.CONFIRMED.value:
                raise RuntimeError("该步骤已确认，如需重跑请 force=true")
        if (
            step_index == session.current_step_index
            and st == StepStatus.CONFIRMED.value
            and not force
        ):
            raise RuntimeError("当前步骤已确认，如需重跑请 force=true")

        session.step_states[step_id]["status"] = StepStatus.RUNNING.value
        session.updated_at = datetime.now()
        self._persist_session(session)
        processor = get_mesh_processor()

        try:
            result = run_debug_step(processor, session.ctx, step_id)
            session.ctx = DebugPipelineContext.load(session.ctx.state_path())
            session.step_states[step_id]["result"] = result
            if result.get("success"):
                session.step_states[step_id]["status"] = StepStatus.AWAITING_CONFIRM.value
            else:
                session.step_states[step_id]["status"] = StepStatus.FAILED.value
            session.updated_at = datetime.now()
            self._persist_session(session)
            return result
        except Exception as e:
            session.step_states[step_id]["status"] = StepStatus.FAILED.value
            session.step_states[step_id]["result"] = {
                "step_id": step_id,
                "success": False,
                "message": str(e),
            }
            session.updated_at = datetime.now()
            self._persist_session(session)
            raise

    def confirm_step(self, session_id: str, step_id: str) -> Dict[str, Any]:
        session = self.get_session(session_id)
        if step_id not in DEBUG_STEP_IDS:
            raise ValueError(f"unknown step: {step_id}")
        step_index = DEBUG_STEP_IDS.index(step_id)
        if step_index != session.current_step_index:
            raise RuntimeError("只能确认当前步骤")

        st = session.step_states[step_id].get("status")
        if st not in (StepStatus.AWAITING_CONFIRM.value,):
            raise RuntimeError(f"当前步骤状态不可确认: {st}")

        result = session.step_states[step_id].get("result") or {}
        if not result.get("success"):
            raise RuntimeError("步骤未成功执行，无法确认")

        session.step_states[step_id]["status"] = StepStatus.CONFIRMED.value
        session.current_step_index = min(
            session.current_step_index + 1, len(DEBUG_STEP_IDS)
        )
        session.updated_at = datetime.now()
        self._persist_session(session)
        return session.to_dict()

    def get_preview_path(self, session_id: str, step_id: str) -> str:
        session = self.get_session(session_id)
        result = session.step_states.get(step_id, {}).get("result") or {}
        preview = result.get("preview_path")
        if preview and os.path.isfile(preview):
            return preview
        if step_id == "prepare" and session.ctx.raw_mesh_path:
            return session.ctx.raw_mesh_path
        raise FileNotFoundError(f"preview not ready for step {step_id}")

    def delete_session(self, session_id: str) -> None:
        with self._lock:
            session = self._sessions.pop(session_id, None)
        debug_root = os.path.join(get_config().service.output_dir, "debug", session_id)
        if os.path.isdir(debug_root):
            try:
                shutil.rmtree(debug_root)
            except OSError as e:
                logger.warning("failed to remove debug dir %s: %s", debug_root, e)
        if session:
            logger.info("debug session deleted: %s", session_id)


_service: Optional[DebugPipelineService] = None


def get_debug_pipeline_service() -> DebugPipelineService:
    global _service
    if _service is None:
        _service = DebugPipelineService()
    return _service
