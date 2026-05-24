"""
3D生成API路由模块
提供图片到3D生成、条件生成、任务查询、网格融合等API接口
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.models.schemas import (
    GenerateRequest,
    GenerateResponse,
    ConditionGenerateRequest,
    MeshFusionRequest,
    MeshFusionResponse,
    TaskStatusResponse,
    TaskResultResponse,
    TaskStatus,
    ResultFormat,
)
from app.services.generator import get_generator_service
from app.services.model_manager import get_model_manager
from app.utils.hardware import get_system_info
from app.config import get_config

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/generate", tags=["3D生成"])


# ============================================================
# 图片到3D生成
# ============================================================

@router.post(
    "/image-to-3d",
    response_model=GenerateResponse,
    summary="图片生成3D模型",
    description="将一张图片转换为3D模型，支持可选的底座网格融合",
)
async def image_to_3d(request: GenerateRequest):
    """
    图片生成3D模型接口

    - **image_path**: 输入图片路径（本地路径或URL）
    - **setting_mesh_path**: 镶嵌底座网格路径（可选）
    - **prompt**: 生成提示词（可选，辅助描述期望的3D效果）
    - **result_format**: 输出格式（glb/obj/stl/ply）
    """
    service = get_generator_service()

    # 创建任务
    task = service.create_task(
        request_type="image_to_3d",
        params=request.model_dump(),
    )

    # 提交到异步队列
    await service.submit_task(task.task_id)

    return GenerateResponse(
        task_id=task.task_id,
        status=task.status,
        message="任务已提交，正在处理中",
    )


# ============================================================
# 条件生成
# ============================================================

@router.post(
    "/condition-generate",
    response_model=GenerateResponse,
    summary="条件生成珠宝3D模型",
    description="设计图 + 镶嵌底座 -> 珠宝3D模型，支持ICP对齐和布尔融合",
)
async def condition_generate(request: ConditionGenerateRequest):
    """
    条件生成接口

    - **design_image_path**: 设计图路径
    - **setting_mesh_path**: 镶嵌底座网格路径
    - **inlay_type**: 镶嵌类型（prong/bezel/pave/channel等）
    - **gem_type**: 宝石类型（diamond/ruby/sapphire等）
    - **prompt**: 生成提示词
    - **result_format**: 输出格式
    """
    service = get_generator_service()

    # 创建任务
    task = service.create_task(
        request_type="condition_generate",
        params=request.model_dump(),
    )

    # 提交到异步队列
    await service.submit_task(task.task_id)

    return GenerateResponse(
        task_id=task.task_id,
        status=task.status,
        message="条件生成任务已提交",
    )


# ============================================================
# 任务状态查询
# ============================================================

@router.get(
    "/status/{task_id}",
    response_model=TaskStatusResponse,
    summary="查询任务状态",
    description="根据任务ID查询生成任务的当前状态和进度",
)
async def get_task_status(task_id: str):
    """
    查询任务状态

    - **task_id**: 任务ID
    """
    service = get_generator_service()
    task = service.get_task(task_id)

    if task is None:
        raise HTTPException(
            status_code=404,
            detail=f"任务不存在: {task_id}"
        )

    return TaskStatusResponse(
        task_id=task.task_id,
        status=task.status,
        progress=task.progress,
        message=task.message,
        current_step=task.current_step,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# ============================================================
# 获取生成结果
# ============================================================

@router.get(
    "/result/{task_id}",
    response_model=TaskResultResponse,
    summary="获取生成结果",
    description="根据任务ID获取生成结果，包含文件下载链接",
)
async def get_task_result(task_id: str):
    """
    获取任务结果

    - **task_id**: 任务ID
    """
    service = get_generator_service()
    task = service.get_task(task_id)

    if task is None:
        raise HTTPException(
            status_code=404,
            detail=f"任务不存在: {task_id}"
        )

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"任务尚未完成，当前状态: {task.status.value}"
        )

    if not task.result_url or not os.path.exists(task.result_url):
        raise HTTPException(
            status_code=404,
            detail="结果文件不存在"
        )

    # 获取文件信息
    file_size = os.path.getsize(task.result_url)
    file_ext = os.path.splitext(task.result_url)[1].lstrip(".")

    return TaskResultResponse(
        task_id=task.task_id,
        status=task.status,
        result_url=f"/api/generate/download/{task_id}",
        result_files=task.result_files or [task.result_url],
        file_size=file_size,
        format=file_ext,
        processing_time=task.processing_time,
        metadata=task.metadata,
    )


# ============================================================
# 文件下载
# ============================================================

@router.get(
    "/download/{task_id}",
    summary="下载生成结果文件",
    description="下载指定任务的生成结果文件",
)
async def download_result(task_id: str):
    """
    下载生成结果文件

    - **task_id**: 任务ID
    """
    service = get_generator_service()
    task = service.get_task(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"任务尚未完成，当前状态: {task.status.value}"
        )

    if not task.result_url or not os.path.exists(task.result_url):
        raise HTTPException(status_code=404, detail="结果文件不存在")

    # 根据文件扩展名设置MIME类型
    file_ext = os.path.splitext(task.result_url)[1].lower()
    media_types = {
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
        ".obj": "application/octet-stream",
        ".stl": "application/octet-stream",
        ".ply": "application/octet-stream",
        ".fbx": "application/octet-stream",
    }
    media_type = media_types.get(file_ext, "application/octet-stream")

    filename = os.path.basename(task.result_url)

    return FileResponse(
        path=task.result_url,
        media_type=media_type,
        filename=filename,
    )


# ============================================================
# 网格融合
# ============================================================

@router.post(
    "/mesh-fusion",
    response_model=MeshFusionResponse,
    summary="网格融合",
    description="将底座网格和生成的网格融合为一个完整模型",
)
async def mesh_fusion(request: MeshFusionRequest):
    """
    网格融合接口

    - **base_mesh_path**: 底座网格文件路径
    - **generated_mesh_path**: 生成的网格文件路径
    - **fusion_method**: 融合方法（boolean/icp_merge/simple）
    - **output_format**: 输出格式
    """
    service = get_generator_service()

    # 创建任务
    task = service.create_task(
        request_type="mesh_fusion",
        params=request.model_dump(),
    )

    # 提交到异步队列
    await service.submit_task(task.task_id)

    return MeshFusionResponse(
        task_id=task.task_id,
        status=task.status,
        message="网格融合任务已提交",
    )


# ============================================================
# 任务列表
# ============================================================

@router.get(
    "/tasks",
    summary="获取任务列表",
    description="获取所有任务列表，支持按状态筛选",
)
async def list_tasks(
    status: Optional[str] = Query(None, description="按状态筛选"),
    limit: int = Query(50, description="返回数量限制", ge=1, le=200),
):
    """
    获取任务列表

    - **status**: 按状态筛选（pending/processing/completed/failed）
    - **limit**: 返回数量限制
    """
    service = get_generator_service()

    task_status = None
    if status:
        try:
            task_status = TaskStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"无效的任务状态: {status}"
            )

    tasks = service.list_tasks(status=task_status, limit=limit)

    return {
        "total": len(tasks),
        "tasks": [
            {
                "task_id": t.task_id,
                "status": t.status.value,
                "progress": t.progress,
                "message": t.message,
                "request_type": t.request_type,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
    }


# ============================================================
# 系统信息
# ============================================================

@router.get(
    "/system-info",
    summary="获取系统信息",
    description="获取GPU信息、模型状态、推荐配置等系统信息",
)
async def system_info():
    """
    获取系统信息
    """
    sys_info = get_system_info()
    model_manager = get_model_manager()
    model_info = model_manager.get_model_info()

    return {
        "gpu_name": sys_info.get("gpu_name", "Unknown"),
        "vram_gb": sys_info.get("vram_gb", 0),
        "cuda_version": sys_info.get("cuda_version"),
        "driver_version": sys_info.get("driver_version"),
        "gpu_available": sys_info.get("gpu_available", False),
        "recommended_model": sys_info.get("recommended_model", "mini"),
        "recommended_config": sys_info.get("recommended_config"),
        "recommendation_reason": sys_info.get("recommendation_reason", ""),
        "model_loaded": model_info.get("loaded", False),
        "current_model_version": model_info.get("version"),
        "loaded_models": model_info.get("models", []),
        "memory_usage_mb": model_info.get("memory_usage_mb", 0),
    }
