"""
Debug pipeline API — step-by-step alignment debugging.
"""

import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import get_config
from app.models.schemas import (
    DebugSessionCreateRequest,
    DebugSessionResponse,
    DebugStepDirectRunRequest,
    DebugStepResultResponse,
    DebugStepRunRequest,
)
from app.services.debug_pipeline import get_debug_pipeline_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/debug", tags=["调试流水线"])

_ALLOWED_MESH_EXT = {".obj", ".glb", ".stl", ".ply", ".fbx"}


def _save_upload(upload: UploadFile, dest_path: str) -> str:
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    data = upload.file.read()
    if not data:
        raise HTTPException(status_code=400, detail=f"上传文件为空: {upload.filename}")
    with open(dest_path, "wb") as f:
        f.write(data)
    return dest_path


def _ext_from_upload(upload: UploadFile, default: str = ".obj") -> str:
    name = upload.filename or ""
    ext = os.path.splitext(name)[1].lower()
    if ext in _ALLOWED_MESH_EXT:
        return ext
    return default


@router.post(
    "/sessions",
    response_model=DebugSessionResponse,
    summary="创建调试会话",
)
async def create_debug_session(request: DebugSessionCreateRequest):
    service = get_debug_pipeline_service()
    try:
        session = service.create_session(
            source_task_id=request.source_task_id,
            raw_mesh_path=request.raw_mesh_path,
            inlay_mesh_path=request.inlay_mesh_path,
            output_format=request.output_format.value,
            enable_icp=request.enable_icp,
            enable_ai_part_split=request.enable_ai_part_split,
            session_id=request.session_id,
        )
        data = session.to_dict()
        return DebugSessionResponse(**{k: data[k] for k in DebugSessionResponse.model_fields})
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("create debug session failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/sessions/standalone",
    response_model=DebugSessionResponse,
    summary="创建独立调试会话（上传 mesh，无需 source_task）",
)
async def create_standalone_debug_session(
    raw_mesh: UploadFile = File(..., description="AI raw mesh (obj/glb/stl)"),
    inlay_mesh: UploadFile = File(..., description="镶嵌底座 mesh (glb/obj/stl)"),
    enable_icp: bool = Form(True),
    enable_ai_part_split: bool = Form(False),
    output_format: str = Form("glb"),
):
    service = get_debug_pipeline_service()
    session_id = str(uuid.uuid4())
    cfg = get_config()
    input_dir = os.path.join(cfg.service.output_dir, "debug", session_id, "inputs")
    raw_ext = _ext_from_upload(raw_mesh, ".obj")
    inlay_ext = _ext_from_upload(inlay_mesh, ".glb")
    raw_path = os.path.join(input_dir, f"raw_mesh{raw_ext}")
    inlay_path = os.path.join(input_dir, f"inlay{inlay_ext}")
    try:
        _save_upload(raw_mesh, raw_path)
        _save_upload(inlay_mesh, inlay_path)
        session = service.create_standalone_session(
            raw_mesh_path=raw_path,
            inlay_mesh_path=inlay_path,
            output_format=output_format,
            enable_icp=enable_icp,
            enable_ai_part_split=enable_ai_part_split,
            session_id=session_id,
        )
        data = session.to_dict()
        return DebugSessionResponse(**{k: data[k] for k in DebugSessionResponse.model_fields})
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("create standalone debug session failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/steps/{step_id}/run",
    response_model=DebugStepResultResponse,
    summary="直接执行调试步骤（无需 session 顺序）",
)
async def run_debug_step_direct(step_id: str, body: DebugStepDirectRunRequest):
    service = get_debug_pipeline_service()
    try:
        result = service.run_step_direct(
            step_id,
            body.raw_mesh_path,
            body.inlay_mesh_path,
            context=body.context,
            force=body.force,
        )
        return DebugStepResultResponse(**result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("run debug step direct %s failed", step_id)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/sessions/{session_id}",
    response_model=DebugSessionResponse,
    summary="获取调试会话状态",
)
async def get_debug_session(session_id: str):
    service = get_debug_pipeline_service()
    try:
        session = service.get_session(session_id)
        data = session.to_dict()
        return DebugSessionResponse(**{k: data[k] for k in DebugSessionResponse.model_fields})
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post(
    "/sessions/{session_id}/steps/{step_id}/run",
    response_model=DebugStepResultResponse,
    summary="执行指定调试步骤",
)
async def run_debug_step(session_id: str, step_id: str, body: DebugStepRunRequest):
    service = get_debug_pipeline_service()
    try:
        result = service.run_step(session_id, step_id, force=body.force)
        return DebugStepResultResponse(**result)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except Exception as e:
        logger.exception("run debug step %s failed", step_id)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/sessions/{session_id}/steps/{step_id}/confirm",
    response_model=DebugSessionResponse,
    summary="确认当前步骤并解锁下一步",
)
async def confirm_debug_step(session_id: str, step_id: str):
    service = get_debug_pipeline_service()
    try:
        data = service.confirm_step(session_id, step_id)
        return DebugSessionResponse(**{k: data[k] for k in DebugSessionResponse.model_fields})
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get(
    "/sessions/{session_id}/preview/{step_id}",
    summary="下载步骤预览 GLB",
)
async def get_debug_preview(session_id: str, step_id: str):
    service = get_debug_pipeline_service()
    try:
        path = service.get_preview_path(session_id, step_id)
        if not os.path.isfile(path):
            raise HTTPException(status_code=404, detail="preview file not found")
        ext = os.path.splitext(path)[1].lower()
        media = "model/gltf-binary" if ext == ".glb" else "application/octet-stream"
        return FileResponse(path, media_type=media, filename=os.path.basename(path))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete(
    "/sessions/{session_id}",
    summary="删除调试会话",
)
async def delete_debug_session(session_id: str):
    service = get_debug_pipeline_service()
    try:
        service.delete_session(session_id)
        return {"success": True, "session_id": session_id}
    except Exception as e:
        logger.warning("delete debug session %s: %s", session_id, e)
        return {"success": True, "session_id": session_id}
