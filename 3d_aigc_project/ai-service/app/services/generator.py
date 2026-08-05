"""
3D生成核心服务模块
调用Hunyuan3D-2进行图片到3D生成
支持点云条件输入、异步任务队列
"""

import os
import asyncio
import logging
import time
from typing import Optional, Dict, Any, Callable, Union
from datetime import datetime

from app.models.schemas import (
    TaskInfo, TaskStatus, GenerateRequest,
    ConditionGenerateRequest, MeshFusionRequest, ResultFormat,
)
from app.services.model_manager import get_model_manager
from app.services.mesh_processor import get_mesh_processor
from app.utils.file_utils import (
    generate_task_id, generate_output_path,
    validate_image_file, validate_mesh_file, ensure_dir,
    load_image_pil,
)
from app.config import (
    get_config,
    resolve_generation_mode,
    resolve_enable_inlay_postprocess,
    resolve_mc_algo,
    GenerationModeSettings,
    UltraModeDisabledError,
)
from app.services.inference_queue import (
    configure_max_gpu_jobs,
    get_gpu_queue_stats,
    is_gpu_busy,
    run_in_gpu_slot,
)
from app.services.postprocess_executor import (
    configure_postprocess_workers,
    get_postprocess_stats,
    submit_postprocess,
)
from app.services.multi_view import (
    filter_views_for_hy3d,
    unsupported_view_keys,
    pick_texture_image_path,
    pick_best_single_view_path,
    pipeline_supports_multi_view,
    multi_view_unavailable_message,
    single_view_unavailable_message,
    HY3D_MV_FACES,
)

logger = logging.getLogger(__name__)


class GeneratorService:
    """
    3D生成服务
    管理异步任务队列，协调模型推理和后处理
    """

    def __init__(self):
        """初始化生成服务"""
        # 内存任务存储（生产环境可替换为Redis）
        self._tasks: Dict[str, TaskInfo] = {}
        # 异步任务句柄（用于 cancel）
        self._async_handles: Dict[str, asyncio.Task] = {}
        self._cancel_flags: set[str] = set()
        # 任务回调函数
        self._callbacks: Dict[str, Callable] = {}
        # 信号量：限制同时处于生命周期内的任务数（验证/后处理可并行）
        self._semaphore: Optional[asyncio.Semaphore] = None
        # 是否已初始化
        self._initialized = False
        self._max_concurrent_tasks: int = 1

    def initialize(self):
        """
        初始化服务
        在应用启动时调用
        """
        config = get_config()
        self._max_concurrent_tasks = config.service.max_concurrent_tasks
        configure_max_gpu_jobs(config.service.max_concurrent_gpu_jobs)
        configure_postprocess_workers(config.service.max_postprocess_workers)
        self._semaphore = asyncio.Semaphore(config.service.max_concurrent_tasks)
        self._initialized = True
        logger.info(
            "生成服务已初始化: max_concurrent_tasks=%d, max_concurrent_gpu_jobs=%d "
            "(GPU 推理实际串行 FIFO)",
            config.service.max_concurrent_tasks,
            config.service.max_concurrent_gpu_jobs,
        )

    # ============================================================
    # 任务管理
    # ============================================================

    def create_task(
        self,
        request_type: str,
        params: Dict[str, Any],
        task_id: Optional[str] = None,
    ) -> TaskInfo:
        """
        创建新的生成任务
        """
        if not task_id:
            task_id = generate_task_id()
        task = TaskInfo(
            task_id=task_id,
            status=TaskStatus.PENDING,
            request_type=request_type,
            params=params,
            message="任务已创建，等待处理",
        )
        self._tasks[task_id] = task
        logger.info(f"任务已创建: {task_id} (类型: {request_type})")
        return task

    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        """获取任务信息"""
        return self._tasks.get(task_id)

    def _is_cancelled(self, task_id: str) -> bool:
        return task_id in self._cancel_flags

    def _cancelled_response(self, task_id: str) -> Optional[Dict[str, Any]]:
        if self._is_cancelled(task_id):
            return {"success": False, "error": "cancelled"}
        return None

    def request_cancel(self, task_id: str) -> Dict[str, Any]:
        """
        请求取消任务（协作式：GPU 推理进行中需等当前步结束）。
        重复调用或已终态任务视为幂等成功。
        """
        task = self.get_task(task_id)
        if task is None:
            return {"task_id": task_id, "cancelled": False, "reason": "not_found"}

        terminal = (
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
        )
        if task.status in terminal:
            return {
                "task_id": task_id,
                "cancelled": task.status == TaskStatus.CANCELLED,
                "status": task.status.value,
                "reason": "already_terminal",
            }

        self._cancel_flags.add(task_id)
        handle = self._async_handles.get(task_id)
        if handle is not None and not handle.done():
            handle.cancel()

        self.update_task(
            task_id,
            status=TaskStatus.CANCELLED,
            message="任务已取消",
        )
        logger.info("任务已请求取消: %s", task_id)
        return {
            "task_id": task_id,
            "cancelled": True,
            "status": TaskStatus.CANCELLED.value,
        }

    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        current_step: Optional[str] = None,
        result_url: Optional[str] = None,
        result_files: Optional[list] = None,
        error: Optional[str] = None,
    ):
        """更新任务状态"""
        task = self._tasks.get(task_id)
        if task is None:
            logger.warning(f"任务不存在: {task_id}")
            return

        if status is not None:
            task.status = status
        if progress is not None:
            task.progress = min(max(progress, 0), 100)
        if message is not None:
            task.message = message
        if current_step is not None:
            task.current_step = current_step
        if result_url is not None:
            task.result_url = result_url
        if result_files is not None:
            task.result_files = result_files
        if error is not None:
            task.error = error

        task.updated_at = datetime.now()

        # 如果任务完成或失败，记录完成时间
        if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            task.completed_at = datetime.now()
            if task.created_at:
                task.processing_time = (
                    task.completed_at - task.created_at
                ).total_seconds()

    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        limit: int = 50,
    ) -> list:
        """列出任务"""
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status == status]
        # 按创建时间倒序
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return tasks[:limit]

    def get_concurrency_stats(self) -> Dict[str, Any]:
        """任务与 GPU 队列指标（供 /health）"""
        tasks = list(self._tasks.values())
        gpu_stats = get_gpu_queue_stats()
        pp_stats = get_postprocess_stats()
        return {
            "active_tasks": sum(
                1 for t in tasks if t.status == TaskStatus.PROCESSING
            ),
            "queued_tasks": sum(
                1 for t in tasks if t.status == TaskStatus.QUEUED
            ),
            "pending_tasks": sum(
                1 for t in tasks if t.status == TaskStatus.PENDING
            ),
            "max_concurrent_tasks": self._max_concurrent_tasks,
            "gpu_queue": gpu_stats,
            "postprocess": pp_stats,
            "queue_depth": int(gpu_stats.get("waiting", 0)) + int(pp_stats.get("queued_jobs", 0)),
            "gpu_job_running": bool(gpu_stats.get("active_task_id")),
        }

    # ============================================================
    # 异步任务执行
    # ============================================================

    async def submit_task(self, task_id: str):
        """
        提交任务到异步执行队列。
        任务先 PENDING，获槽位后 QUEUED/PROCESSING；GPU 阶段 FIFO 串行。
        """
        if not self._initialized:
            logger.error("生成服务未初始化")
            self.update_task(
                task_id, status=TaskStatus.FAILED,
                error="生成服务未初始化"
            )
            return

        if self._semaphore is None:
            logger.error("并发信号量未初始化")
            return

        handle = asyncio.create_task(self._execute_task(task_id))
        self._async_handles[task_id] = handle

        def _cleanup(_t: asyncio.Task) -> None:
            self._async_handles.pop(task_id, None)

        handle.add_done_callback(_cleanup)

    async def _run_gpu_phase(self, task_id: str, fn):
        """
        在专用 GPU 推理队列中执行 fn（阻塞部分在线程池，不卡事件循环）。
        等待期间将任务标为 QUEUED；获得槽位后标为 PROCESSING。
        """
        cancelled = self._cancelled_response(task_id)
        if cancelled is not None:
            return cancelled

        if is_gpu_busy():
            self.update_task(
                task_id,
                status=TaskStatus.QUEUED,
                message="排队等待 GPU 推理（前方有任务进行中）",
            )

        def _on_active():
            if self._is_cancelled(task_id):
                return
            self.update_task(
                task_id,
                status=TaskStatus.PROCESSING,
                message="GPU 推理中",
                current_step="3D模型生成中",
            )

        result = await asyncio.to_thread(
            run_in_gpu_slot, task_id, fn, on_active=_on_active
        )
        cancelled = self._cancelled_response(task_id)
        if cancelled is not None:
            return cancelled
        return result

    async def _execute_task(self, task_id: str):
        """
        执行任务（任务级并发 + GPU 推理 FIFO 串行）
        """
        async with self._semaphore:
            task = self.get_task(task_id)
            if task is None:
                return

            try:
                if self._is_cancelled(task_id):
                    return

                if task.status == TaskStatus.PENDING:
                    self.update_task(
                        task_id,
                        status=TaskStatus.PROCESSING,
                        progress=0,
                        message="任务开始处理",
                    )

                # 根据请求类型分发到不同的处理函数
                if task.request_type == "image_to_3d":
                    result = await self._process_image_to_3d(task_id)
                elif task.request_type == "condition_generate":
                    result = await self._process_condition_generate(task_id)
                elif task.request_type == "mesh_fusion":
                    result = await self._process_mesh_fusion(task_id)
                else:
                    raise ValueError(f"未知的请求类型: {task.request_type}")

                if self._is_cancelled(task_id):
                    return

                if result.get("success"):
                    meta: Dict[str, Any] = {}
                    if result.get("fusion_warning"):
                        meta["fusion_warning"] = result["fusion_warning"]
                    if result.get("preview_path"):
                        meta["preview_path"] = result["preview_path"]
                    if result.get("condition_mode"):
                        meta["condition_mode"] = result["condition_mode"]
                    if result.get("inlay_overlap_ratio") is not None:
                        meta["inlay_overlap_ratio"] = result["inlay_overlap_ratio"]
                    if result.get("overlap_refine_applied") is not None:
                        meta["overlap_refine_applied"] = result["overlap_refine_applied"]
                    if result.get("omni_fallback_reason"):
                        meta["omni_fallback_reason"] = result["omni_fallback_reason"]
                    cad_rev = result.get("cad_reverse") or {}
                    if cad_rev:
                        meta["cad_reverse"] = {
                            k: cad_rev.get(k)
                            for k in (
                                "success",
                                "step_path",
                                "score_0_100",
                                "max_deviation_mm",
                                "surface_count",
                                "quality_passed",
                                "warning",
                                "error",
                            )
                            if cad_rev.get(k) is not None
                        }
                    self.update_task(
                        task_id,
                        status=TaskStatus.COMPLETED,
                        progress=100,
                        message="任务完成",
                        result_url=result.get("output_path"),
                        result_files=result.get("output_files", []),
                    )
                    task_obj = self.get_task(task_id)
                    if task_obj and meta:
                        task_obj.metadata.update(meta)
                else:
                    if result.get("error") == "cancelled":
                        self.update_task(
                            task_id,
                            status=TaskStatus.CANCELLED,
                            message="任务已取消",
                        )
                    else:
                        self.update_task(
                            task_id,
                            status=TaskStatus.FAILED,
                            message="任务处理失败",
                            error=result.get("error", "未知错误"),
                        )

            except asyncio.CancelledError:
                self.update_task(
                    task_id,
                    status=TaskStatus.CANCELLED,
                    message="任务已取消",
                )
            except Exception as e:
                logger.error(f"任务执行异常: {e}", exc_info=True)
                self.update_task(
                    task_id,
                    status=TaskStatus.FAILED,
                    message="任务执行异常",
                    error=str(e),
                )
            finally:
                self._cancel_flags.discard(task_id)

    async def _process_image_to_3d(self, task_id: str) -> Dict[str, Any]:
        """
        处理图片到3D生成任务

        流程:
        1. 验证输入图片
        2. 加载模型（如未加载）
        3. 调用Hunyuan3D-2生成3D模型
        4. （可选）后处理（与底座融合）
        5. 保存结果
        """
        task = self.get_task(task_id)
        config = get_config()
        params = task.params

        cancelled = self._cancelled_response(task_id)
        if cancelled is not None:
            return cancelled

        # 步骤1: 验证输入
        self.update_task(task_id, progress=5, current_step="验证输入")
        image_path = params.get("image_path", "")
        multi_view = params.get("multi_view", False)
        raw_views = params.get("views") or {}

        views_for_gen: Dict[str, str] = {}
        if raw_views:
            for face, path in raw_views.items():
                if path and validate_image_file(path):
                    views_for_gen[face] = path
                elif path:
                    return {"success": False, "error": f"无效的视角图像: {face}={path}"}

        use_multi_view = multi_view or len(views_for_gen) >= 2
        hy3d_views: Optional[Dict[str, str]] = None

        if use_multi_view:
            if len(views_for_gen) < 2:
                return {"success": False, "error": "多视图模式至少需要 2 个有效视角图片"}
            from app.services.multi_view import canonicalize_views_for_hy3d

            views_for_gen = canonicalize_views_for_hy3d(views_for_gen)
            hy3d_views = dict(views_for_gen)
            if len(hy3d_views) < 2:
                skipped = unsupported_view_keys(views_for_gen)
                return {
                    "success": False,
                    "error": (
                        f"hy3dgen 多视图至少需要 2 个水平视角"
                        f"（{', '.join(HY3D_MV_FACES)}），"
                        f"当前可用 {len(hy3d_views)} 个。"
                        f"已上传但不参与生成的视角: {', '.join(skipped) or '无'}"
                    ),
                }
            unsupported = unsupported_view_keys(views_for_gen)
            if unsupported:
                logger.warning(
                    "以下视角已上传但 hy3dgen 暂不支持，生成时将忽略: %s",
                    ", ".join(unsupported),
                )
            if not image_path:
                image_path = pick_texture_image_path(views_for_gen, "")
        elif not validate_image_file(image_path):
            return {"success": False, "error": f"无效的图像文件: {image_path}"}

        # 验证可选的底座网格
        setting_mesh_path = params.get("setting_mesh_path")
        if setting_mesh_path and not validate_mesh_file(setting_mesh_path):
            return {
                "success": False,
                "error": f"无效的镶嵌底座网格: {setting_mesh_path}",
            }

        apply_texture = self._resolve_apply_texture(params)
        enable_inlay_postprocess = resolve_enable_inlay_postprocess(params)
        enable_icp = params.get("enable_icp_alignment", True)
        result_format = params.get("result_format") or "glb"
        try:
            mode_settings = resolve_generation_mode(
                params.get("generation_mode"), params=params
            )
        except UltraModeDisabledError as e:
            return {"success": False, "error": str(e)}
        hy3d_views: Optional[Dict[str, str]] = None
        logger.info(
            "生成模式: %s (steps=%d octree=%d taubin=%d jewelry_finish=%s)",
            params.get("generation_mode", "quality"),
            mode_settings.config.num_inference_steps,
            mode_settings.config.octree_resolution,
            mode_settings.config.jewelry_taubin_iterations,
            mode_settings.apply_jewelry_mesh_finish,
        )

        if setting_mesh_path:
            self.update_task(task_id, progress=15, current_step="准备镶嵌条件")
            params["prompt"] = await self._prepare_track_a_prompt(
                params, setting_mesh_path, params.get("prompt") or "珠宝主体装饰结构"
            )
            logger.info("轨道A：已用镶嵌底座点云增强生成 prompt")

        condition_features = None
        use_omni = params.get("use_omni_conditioning")
        if use_omni is None:
            use_omni = get_config().omni.enabled
        if setting_mesh_path and use_omni:
            try:
                from app.services.pointcloud_conditioner import get_pointcloud_conditioner

                cfg = get_config()
                conditioner = get_pointcloud_conditioner(cfg.model.point_cloud_density)
                condition_features = await asyncio.to_thread(
                    conditioner.build_condition_features,
                    setting_mesh_path,
                    for_omni=True,
                )
            except Exception as e:
                logger.warning("Omni 点云条件构建失败，将回退 image-only: %s", e)

        from app.services.inlay_gen_strategy import (
            resolve_inlay_gen_strategy,
            strategy_forces_single_view,
        )

        inlay_strategy = resolve_inlay_gen_strategy(
            params,
            use_multi_view=use_multi_view,
            has_inlay=bool(setting_mesh_path),
            omni_enabled=bool(use_omni),
        )
        params["inlay_gen_strategy_resolved"] = inlay_strategy.value
        if setting_mesh_path and strategy_forces_single_view(inlay_strategy):
            use_multi_view = False
            hy3d_views = None
            if not image_path or not validate_image_file(image_path):
                image_path = pick_texture_image_path(views_for_gen, "") or image_path
            logger.info(
                "inlay_gen_strategy=%s：使用单视图+Omni 点云条件",
                inlay_strategy.value,
            )

        preprocessed_views: Optional[Dict[str, str]] = None
        if setting_mesh_path and use_multi_view and hy3d_views:
            apply_render = params.get("apply_inlay_render_condition")
            if apply_render is None:
                apply_render = True
            working_views = dict(hy3d_views)
            if apply_render:
                from app.services.inlay_render_condition import apply_inlay_render_condition

                working_views, render_info = await asyncio.to_thread(
                    apply_inlay_render_condition,
                    working_views,
                    setting_mesh_path,
                    config.service.output_dir,
                    task_id,
                )
                params["inlay_render_condition"] = render_info
            from app.services.inlay_image_scale import calibrate_views_for_inlay

            working_views, scale_info = await asyncio.to_thread(
                calibrate_views_for_inlay,
                working_views,
                config.service.output_dir,
                task_id,
                condition_features=condition_features,
                stone_diameter_mm=params.get("stone_diameter_mm"),
            )
            params["inlay_image_scale"] = scale_info
            preprocessed_views = working_views
        elif setting_mesh_path and image_path and validate_image_file(image_path):
            from app.services.inlay_image_scale import calibrate_view_image

            scaled_path = os.path.join(
                config.service.output_dir, task_id, "scaled_front.png"
            )
            image_path, scale_one = await asyncio.to_thread(
                calibrate_view_image,
                image_path,
                scaled_path,
                condition_features=condition_features,
                stone_diameter_mm=params.get("stone_diameter_mm"),
            )
            params["inlay_image_scale"] = {"front": scale_one}

        # 步骤2-3: 模型加载 + Hunyuan3D 推理（GPU 阶段，FIFO 串行）
        self.update_task(task_id, progress=10, current_step="加载模型")

        def _gpu_load_and_generate():
            model_manager = get_model_manager()
            from app.services.repaint_model_manager import get_repaint_model_manager
            repaint_mm = get_repaint_model_manager()
            if repaint_mm.is_loaded():
                repaint_mm.unload()

            if not model_manager.is_loaded():
                logger.info("模型未加载，开始加载...")
                if not model_manager.load_model():
                    detail = model_manager.get_last_load_error() or "模型加载失败"
                    return {"success": False, "error": detail}

            nonlocal use_multi_view, hy3d_views, image_path
            from app.services.multi_view import canonicalize_views_for_hy3d

            if use_multi_view:
                hy3d_views = preprocessed_views or hy3d_views or canonicalize_views_for_hy3d(views_for_gen)
                if not self._ensure_multi_view_pipeline(model_manager):
                    fallback_path = pick_best_single_view_path(views_for_gen) or image_path
                    if not fallback_path or not validate_image_file(fallback_path):
                        return {
                            "success": False,
                            "error": multi_view_unavailable_message(fallback_failed=True),
                        }
                    logger.warning(
                        "当前 ShapeGen 不支持多视图且未加载 MV 模型，"
                        "将仅使用视角 [%s] 进行单图生成。",
                        next(
                            (k for k, v in views_for_gen.items() if v == fallback_path),
                            "front",
                        ),
                    )
                    use_multi_view = False
                    hy3d_views = None
                    image_path = fallback_path
            else:
                if not self._ensure_single_view_pipeline(model_manager):
                    return {
                        "success": False,
                        "error": single_view_unavailable_message(),
                    }

            prompt_local = params.get("prompt") or ""
            negative_prompt = params.get("negative_prompt") or ""

            if mode_settings.apply_jewelry_prompt:
                jewelry_style = (
                    "，高精度珠宝CAD风格，光滑抛光金属与宝石曲面，"
                    "对称规整，大面平整，过渡圆顺，无凹凸噪点无网格坑洞无尖刺"
                )
                jewelry_negative = (
                    "rough surface,bumpy,noisy,jagged edges,spikey,thin spikes,wire spikes,"
                    "low poly artifacts,faceted noise,holes,cracks,asymmetric distortion,"
                    "pitted surface,wavy uneven metal,bumps,lumps,cellular noise,micro bumps"
                )
                if jewelry_style not in prompt_local:
                    prompt_local = (prompt_local or "珠宝主体装饰结构") + jewelry_style
                if not negative_prompt.strip():
                    negative_prompt = jewelry_negative

            return self._run_hunyuan3d_generation(
                image_path=image_path,
                prompt=prompt_local,
                negative_prompt=negative_prompt,
                output_dir=config.service.output_dir,
                task_id=task_id,
                result_format=result_format,
                views=hy3d_views if use_multi_view else None,
                apply_texture=apply_texture,
                mode_settings=mode_settings,
                setting_mesh_path=setting_mesh_path,
                condition_features=condition_features,
                use_omni_conditioning=bool(use_omni and setting_mesh_path),
                stone_diameter_mm=params.get("stone_diameter_mm"),
                inlay_gen_strategy=inlay_strategy.value,
            )

        self.update_task(
            task_id,
            progress=20,
            current_step="3D模型生成中",
            message="GPU 推理中",
        )
        gen_result = await self._run_gpu_phase(task_id, _gpu_load_and_generate)

        if gen_result.get("success"):
            self.update_task(
                task_id,
                status=TaskStatus.PROCESSING,
                message="GPU 推理完成，后处理中",
            )

        if not gen_result.get("success"):
            return gen_result

        cancelled = self._cancelled_response(task_id)
        if cancelled is not None:
            return cancelled

        self.update_task(task_id, progress=70, current_step="后处理")

        # 用户下载产物（generated.stl 等）；融合输入优先 raw OBJ 避免 STL 往返空网格
        user_output_path = gen_result["output_path"]
        fusion_input_path = gen_result.get("raw_path") or user_output_path
        generated_mesh = user_output_path
        preview_mesh_path: Optional[str] = None
        fusion_warning: Optional[str] = None
        condition_mode = gen_result.get("condition_mode", "image_only")
        inlay_overlap_ratio: Optional[float] = None
        overlap_refine_applied: Optional[bool] = None

        # 步骤4: 后处理（与底座融合）
        if setting_mesh_path and enable_inlay_postprocess:
            self.update_task(task_id, progress=75, current_step="ICP对齐与分色合并")
            processor = get_mesh_processor()
            fusion_method = params.get("fusion_method") or "colored_merge"

            def _run_postprocess():
                return processor.process_generated_mesh(
                    generated_mesh_path=fusion_input_path,
                    base_mesh_path=setting_mesh_path,
                    output_dir=config.service.output_dir,
                    task_id=task_id,
                    fusion_method=fusion_method,
                    enable_icp=enable_icp,
                    enable_repair=True,
                    output_format=result_format,
                    apply_jewelry_repair_smooth=mode_settings.apply_jewelry_repair_smooth,
                    generation_config=mode_settings.config,
                    enable_fast_size_align=params.get("enable_fast_size_align"),
                )

            loop = asyncio.get_running_loop()
            process_result = await loop.run_in_executor(
                None,
                lambda: submit_postprocess(_run_postprocess).result(),
            )
            if process_result.get("success"):
                generated_mesh = process_result["output_path"]
                preview_mesh_path = process_result.get("preview_path")
                fusion_warning = process_result.get("fusion_warning")
                align_info = (process_result.get("alignment") or {})
                if align_info.get("inlay_overlap_ratio") is not None:
                    inlay_overlap_ratio = float(align_info["inlay_overlap_ratio"])
                overlap_refine_applied = bool(
                    align_info.get("overlap_refine_applied")
                    or (align_info.get("overlap_refine_ring_frame") or {}).get("refined")
                    or (align_info.get("overlap_refine_post_icp") or {}).get("refined")
                )
            else:
                logger.warning(
                    "镶嵌底座融合失败: %s；回退为用户格式产物 %s",
                    process_result.get("error", "unknown"),
                    user_output_path,
                )
                generated_mesh = user_output_path
                fusion_warning = None
        elif setting_mesh_path and not enable_inlay_postprocess:
            logger.info("已提供镶嵌底座但 enable_inlay_postprocess=false，跳过镶嵌后处理")
        else:
            generated_mesh = gen_result["output_path"]

        self.update_task(task_id, progress=95, current_step="保存结果")

        output_files = [generated_mesh]
        if preview_mesh_path and preview_mesh_path not in output_files:
            output_files.append(preview_mesh_path)
        cad_reverse = gen_result.get("cad_reverse") or {}
        if cad_reverse.get("step_path"):
            output_files.append(cad_reverse["step_path"])
        report_path = os.path.join(
            get_config().service.output_dir, task_id, "cad_fit_report.json"
        )
        if os.path.isfile(report_path):
            output_files.append(report_path)

        payload: Dict[str, Any] = {
            "success": True,
            "output_path": generated_mesh,
            "preview_path": preview_mesh_path,
            "output_files": output_files,
        }
        if cad_reverse:
            payload["cad_reverse"] = cad_reverse
            if cad_reverse.get("warning") and not fusion_warning:
                fusion_warning = cad_reverse.get("warning")
        if fusion_warning:
            payload["fusion_warning"] = fusion_warning
        payload["condition_mode"] = condition_mode
        if inlay_overlap_ratio is not None:
            payload["inlay_overlap_ratio"] = inlay_overlap_ratio
        if overlap_refine_applied is not None:
            payload["overlap_refine_applied"] = overlap_refine_applied
        if gen_result.get("omni_fallback_reason"):
            payload["omni_fallback_reason"] = gen_result["omni_fallback_reason"]
        return payload

    @staticmethod
    def _resolve_apply_texture(params: Dict[str, Any]) -> bool:
        """轨道A 默认纯几何；请求可显式覆盖 apply_texture"""
        if params.get("apply_texture") is not None:
            return bool(params["apply_texture"])
        return not get_config().service.track_a_geometry_only

    async def _prepare_track_a_prompt(
        self,
        params: Dict[str, Any],
        setting_mesh_path: str,
        base_prompt: str,
    ) -> str:
        """
        轨道A：镶嵌底座点云 + 库信息 → 增强 prompt，引导 AI 生成主体而非重复镶嵌爪位
        """
        inlay_info = await self._query_inlay_database(params)
        point_cloud_features = None
        try:
            from app.services.pointcloud_conditioner import get_pointcloud_conditioner

            cfg = get_config()
            conditioner = get_pointcloud_conditioner(cfg.model.point_cloud_density)
            point_cloud_features = await asyncio.to_thread(
                conditioner.build_condition_features,
                setting_mesh_path,
            )
            params["point_cloud_features"] = {
                "bbox": point_cloud_features.get("bbox"),
                "center": point_cloud_features.get("center"),
                "num_points": point_cloud_features.get("num_points"),
                "has_normals": point_cloud_features.get("normals") is not None,
                "has_contact_markers": point_cloud_features.get("contact_markers") is not None,
            }
            if inlay_info is None and point_cloud_features:
                inlay_info = {"type": params.get("inlay_type", "custom")}
        except Exception as e:
            logger.warning(f"点云条件生成失败，继续基础 prompt: {e}")

        gem_type = params.get("gem_type", "diamond")
        inlay_type = params.get("inlay_type", "prong")
        enhanced = self._build_condition_prompt(
            prompt=base_prompt,
            gem_type=gem_type,
            inlay_type=inlay_type,
            inlay_info=inlay_info,
            point_cloud_features=params.get("point_cloud_features"),
        )
        suffix = (
            "。镶嵌底座已由标准库提供，请仅生成与之衔接的珠宝主体与装饰结构，"
            "不要重复生成爪位、镶口等底座细节。"
        )
        return enhanced + suffix

    @staticmethod
    def _ensure_multi_view_pipeline(model_manager) -> bool:
        """确保 ShapeGen 支持多视图；必要时尝试加载本地 MV 模型"""
        if model_manager.supports_multi_view():
            return True
        if model_manager.try_switch_to_multi_view_model():
            return True
        return False

    @staticmethod
    def _ensure_single_view_pipeline(model_manager) -> bool:
        """
        确保单图任务可执行。
        MV pipeline 支持 {\"front\": image} 单视角输入，无需切换权重。
        """
        if not model_manager.supports_multi_view():
            return True
        if model_manager.is_loaded() and model_manager.get_model("shape_gen") is not None:
            return True
        return model_manager.try_switch_to_single_view_model()

    @staticmethod
    def _build_shape_gen_kwargs(gen_cfg, box_v_override: Optional[float] = None) -> Dict[str, Any]:
        """构建 Hunyuan3D ShapeGen 推理参数（珠宝默认）"""
        kwargs: Dict[str, Any] = {
            "num_inference_steps": gen_cfg.num_inference_steps,
            "guidance_scale": gen_cfg.guidance_scale,
            "octree_resolution": gen_cfg.octree_resolution,
            "num_chunks": gen_cfg.num_chunks,
            "mc_level": gen_cfg.mc_level,
            "box_v": float(box_v_override if box_v_override is not None else gen_cfg.box_v),
            "output_type": "trimesh",
            "enable_pbar": False,
        }
        resolved_mc = resolve_mc_algo(gen_cfg.mc_algo)
        if resolved_mc:
            kwargs["mc_algo"] = resolved_mc
        return kwargs

    @staticmethod
    def _invoke_shape_gen(shape_gen, image_input, gen_cfg, box_v_override: Optional[float] = None):
        """调用 ShapeGen，mc_algo 不可用时自动回退（须在 GPU 推理槽位内调用）"""
        kwargs = GeneratorService._build_shape_gen_kwargs(gen_cfg, box_v_override)
        mc_algo = kwargs.get("mc_algo")
        try:
            mesh_outputs = shape_gen(image=image_input, **kwargs)
        except Exception as e:
            if not mc_algo:
                raise
            logger.warning(
                "mc_algo=%s 提取曲面失败，回退默认算法: %s",
                mc_algo,
                e,
            )
            kwargs.pop("mc_algo", None)
            return shape_gen(image=image_input, **kwargs)

        if GeneratorService._extract_first_mesh(mesh_outputs) is None and mc_algo:
            logger.warning(
                "mc_algo=%s 未产生有效网格（hy3dgen 内部吞掉异常），回退默认 marching cubes 重试",
                mc_algo,
            )
            kwargs.pop("mc_algo", None)
            return shape_gen(image=image_input, **kwargs)
        return mesh_outputs

    def _run_hunyuan3d_generation(
        self,
        image_path: str,
        prompt: str = "",
        negative_prompt: str = "",
        output_dir: str = "./outputs/",
        task_id: str = "",
        result_format: str = "glb",
        apply_texture: bool = False,
        views: Optional[Dict[str, str]] = None,
        mode_settings: Optional[GenerationModeSettings] = None,
        setting_mesh_path: Optional[str] = None,
        condition_features: Optional[Dict[str, Any]] = None,
        use_omni_conditioning: bool = False,
        stone_diameter_mm: Optional[float] = None,
        inlay_gen_strategy: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        执行Hunyuan3D-2图片到3D生成

        在线程中运行，避免阻塞事件循环
        """
        model_manager = get_model_manager()
        config = get_config()
        if mode_settings is None:
            mode_settings = resolve_generation_mode("quality")
        gen_cfg = mode_settings.config
        condition_mode = "image_only"
        omni_meta: Dict[str, Any] = {}

        from app.services.conditional_generator import (
            OmniConditionalGenerator,
            estimate_dynamic_box_v,
        )
        from app.services.inlay_gen_strategy import (
            InlayGenStrategy,
            strategy_runs_post_mv_omni,
        )
        from app.services.multi_view import (
            canonicalize_views_for_hy3d,
            pick_texture_image_path,
        )

        strategy = InlayGenStrategy.MV_ONLY
        if inlay_gen_strategy:
            try:
                strategy = InlayGenStrategy(inlay_gen_strategy)
            except ValueError:
                pass

        box_v_override = estimate_dynamic_box_v(
            condition_features,
            stone_diameter_mm,
            default_box_v=gen_cfg.box_v,
        )
        if condition_features and box_v_override != gen_cfg.box_v:
            logger.info(
                "动态 box_v: %.4f (default=%.4f stone_d=%s)",
                box_v_override,
                gen_cfg.box_v,
                stone_diameter_mm,
            )

        try:
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
            import trimesh

            logger.info(
                "开始Hunyuan3D-2生成: image=%s, multi_view=%s, strategy=%s, omni=%s",
                image_path,
                views is not None and len(views or {}) >= 2,
                strategy.value,
                use_omni_conditioning and condition_features is not None,
            )

            mesh = None
            mv_mesh = None
            run_omni_upfront = (
                use_omni_conditioning
                and condition_features
                and not (views and len(views) >= 2)
            )
            if run_omni_upfront:
                omni_gen = OmniConditionalGenerator(model_manager)
                mesh, omni_meta = omni_gen.generate(
                    image_path,
                    condition_features,
                    gen_cfg,
                    prompt=prompt,
                )
                condition_mode = omni_meta.get("condition_mode", "image_only")

            # 获取模型（Omni 失败或未启用时走 ShapeGen）
            shape_gen = model_manager.get_model("shape_gen")
            if mesh is None:
                if shape_gen is None:
                    logger.info("使用hy3dgen便捷API进行生成...")
                    if views and len(views) >= 2:
                        return {
                            "success": False,
                            "error": "多视图生成需要加载 Hunyuan3D ShapeGen 模型（便捷 API 不支持多视图）",
                        }
                    return self._run_hy3dgen_simple(
                        image_path, prompt, output_dir, task_id, result_format
                    )

                logger.info(
                    "ShapeGen 推理参数: steps=%d guidance=%.2f octree=%d chunks=%d mc_algo=%s box_v=%.3f",
                    gen_cfg.num_inference_steps,
                    gen_cfg.guidance_scale,
                    gen_cfg.octree_resolution,
                    gen_cfg.num_chunks,
                    gen_cfg.mc_algo or "default",
                    box_v_override,
                )
                logger.info("正在生成3D网格...")
                if views and len(views) >= 2:
                    if not pipeline_supports_multi_view(shape_gen):
                        return {
                            "success": False,
                            "error": multi_view_unavailable_message(),
                        }
                    canon_views = canonicalize_views_for_hy3d(views)
                    image_input = {
                        face: load_image_pil(path, preserve_alpha=True)
                        for face, path in canon_views.items()
                    }
                    logger.info("多视图输入(canonical): %s", list(image_input.keys()))
                    mesh_outputs = self._invoke_shape_gen(
                        shape_gen, image_input, gen_cfg, box_v_override
                    )
                else:
                    pil_image = load_image_pil(image_path, preserve_alpha=True)
                    if pipeline_supports_multi_view(shape_gen):
                        logger.info("单图模式：使用 MV pipeline 的 front 视角输入")
                        mesh_outputs = self._invoke_shape_gen(
                            shape_gen, {"front": pil_image}, gen_cfg, box_v_override
                        )
                    else:
                        mesh_outputs = self._invoke_shape_gen(
                            shape_gen, pil_image, gen_cfg, box_v_override
                        )
                mesh = self._extract_first_mesh(mesh_outputs)
                if mesh is not None and views and len(views) >= 2:
                    mv_mesh = mesh
                condition_mode = "image_only"
                if use_omni_conditioning and omni_meta.get("omni_fallback_reason"):
                    omni_meta.setdefault("condition_mode", "image_only")

            if (
                mesh is not None
                and strategy_runs_post_mv_omni(strategy)
                and condition_features
                and use_omni_conditioning
            ):
                refine_image = pick_texture_image_path(views, image_path)
                omni_gen = OmniConditionalGenerator(model_manager)
                omni_mesh, omni_meta_refine = omni_gen.generate(
                    refine_image,
                    condition_features,
                    gen_cfg,
                    prompt=prompt,
                )
                if omni_mesh is not None:
                    mesh = omni_mesh
                    condition_mode = omni_meta_refine.get("condition_mode", "omni_refine")
                    omni_meta.update(omni_meta_refine)
                    omni_meta["mv_then_omni_refine"] = True
                    logger.info("MV+Omni refine: 使用 Omni 点云条件网格替换 MV 粗模")
                else:
                    omni_meta["mv_then_omni_refine_fallback"] = omni_meta_refine.get(
                        "omni_fallback_reason"
                    )
                    logger.warning(
                        "MV+Omni refine 回退 MV 粗模: %s",
                        omni_meta_refine.get("omni_fallback_reason"),
                    )
                    mesh = mv_mesh or mesh

            # 生成输出路径
            raw_output_path = generate_output_path(
                output_dir, task_id, f"raw_mesh.obj"
            )

            if mesh is not None:
                # 保存原始OBJ
                if hasattr(mesh, 'export'):
                    mesh.export(raw_output_path)
                elif hasattr(mesh, 'vertices') and hasattr(mesh, 'faces'):
                    tri_mesh = trimesh.Trimesh(
                        vertices=mesh.vertices, faces=mesh.faces
                    )
                    tri_mesh.export(raw_output_path)
                else:
                    # 如果返回的是文件路径
                    raw_output_path = str(mesh)

                logger.info(f"3D网格已生成: {raw_output_path}")

                # 珠宝曲面后处理（去尖刺/锯齿，轻度平滑）
                if mode_settings.apply_jewelry_mesh_finish:
                    try:
                        processor = get_mesh_processor()
                        finished_path = generate_output_path(
                            output_dir, task_id, "finished_raw.obj"
                        )
                        processor.jewelry_finish_mesh(
                            raw_output_path,
                            finished_path,
                            generation_config=gen_cfg,
                        )
                        raw_output_path = finished_path
                        if gen_cfg.jewelry_taubin_iterations > 0:
                            logger.info("珠宝曲面后处理完成: %s", raw_output_path)
                        else:
                            logger.info("急速模式拓扑修复完成: %s", raw_output_path)
                    except Exception as e:
                        logger.warning("珠宝/拓扑后处理跳过: %s", e)
                else:
                    logger.info("后处理已禁用：保留原始生成网格")

                cad_reverse_result: Optional[Dict[str, Any]] = None
                if mode_settings.apply_cad_reverse and mode_settings.ultra_cad:
                    try:
                        from app.services.cad_reverse import cad_reverse_mesh

                        self.update_task(
                            task_id,
                            progress=55,
                            current_step="CAD曲面逆向",
                            message="Mesh → NURBS/STEP 拟合中",
                        )
                        cad_reverse_result = cad_reverse_mesh(
                            raw_output_path,
                            output_dir,
                            task_id,
                            ultra_cad=mode_settings.ultra_cad,
                        )
                        if cad_reverse_result.get("success") and cad_reverse_result.get(
                            "step_path"
                        ):
                            logger.info(
                                "Ultra CAD STEP 导出完成: %s",
                                cad_reverse_result["step_path"],
                            )
                        elif cad_reverse_result.get("warning"):
                            logger.warning(
                                "Ultra CAD 拟合告警: %s",
                                cad_reverse_result.get("warning"),
                            )
                    except Exception as e:
                        logger.warning("Ultra CAD 逆向跳过: %s", e)
                        cad_reverse_result = {
                            "success": False,
                            "error": str(e),
                            "warning": "cad_reverse_failed_mesh_fallback",
                        }

                # 轨道A：纹理生成（Hunyuan3D-Paint）
                textured_path = raw_output_path
                if apply_texture:
                    texture_source = pick_texture_image_path(views, image_path)
                    textured_path = self._apply_texture_generation(
                        mesh_path=raw_output_path,
                        image_path=texture_source,
                        output_dir=output_dir,
                        task_id=task_id,
                        result_format=result_format,
                    ) or raw_output_path

                final_path = generate_output_path(
                    output_dir, task_id, f"generated.{result_format}"
                )
                if textured_path != final_path:
                    processor = get_mesh_processor()
                    final_path = processor.convert_format(textured_path, final_path)

                return {
                    "success": True,
                    "output_path": final_path,
                    "raw_path": raw_output_path,
                    "condition_mode": condition_mode,
                    "inlay_gen_strategy": strategy.value,
                    "omni_fallback_reason": omni_meta.get("omni_fallback_reason"),
                    "omni_meta": omni_meta,
                    "cad_reverse": cad_reverse_result,
                }
            else:
                return {"success": False, "error": "模型未生成有效结果"}

        except ImportError as e:
            logger.error(f"缺少依赖库: {e}")
            # 回退到便捷API
            return self._run_hy3dgen_simple(
                image_path, prompt, output_dir, task_id, result_format
            )
        except Exception as e:
            logger.error(f"Hunyuan3D-2生成失败: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    @staticmethod
    def _extract_first_mesh(mesh_outputs):
        """从 Hunyuan3D pipeline 返回值中提取首个网格（List[List[Trimesh]]）"""
        if not mesh_outputs:
            return None
        first = mesh_outputs[0]
        if isinstance(first, list):
            return first[0] if first else None
        return first

    def _apply_texture_generation(
        self,
        mesh_path: str,
        image_path: str,
        output_dir: str,
        task_id: str,
        result_format: str,
    ) -> Optional[str]:
        """调用纹理生成管线为网格烘焙 PBR 纹理"""
        model_manager = get_model_manager()
        tex_gen = model_manager.get_model("tex_gen")
        if tex_gen is None:
            logger.info("纹理模型未加载，跳过纹理生成")
            return None

        try:
            output_path = generate_output_path(
                output_dir, task_id, f"textured.{result_format}"
            )
            logger.info("开始纹理生成...")
            if callable(tex_gen):
                result = tex_gen(mesh=mesh_path, image=image_path)
                if hasattr(result, "export"):
                    result.export(output_path)
                    return output_path
                if isinstance(result, str) and os.path.exists(result):
                    return result
            logger.warning("纹理生成未返回有效结果")
            return None
        except Exception as e:
            logger.warning(f"纹理生成失败，使用无纹理网格: {e}")
            return None

    def _run_hy3dgen_simple(
        self,
        image_path: str,
        prompt: str,
        output_dir: str,
        task_id: str,
        result_format: str,
    ) -> Dict[str, Any]:
        """
        使用hy3dgen的便捷API进行生成
        作为模型管理器的备选方案
        """
        try:
            from hy3dgen import image_to_3d

            logger.info("使用hy3dgen便捷API...")

            # 生成输出路径
            output_path = generate_output_path(
                output_dir, task_id, f"generated.{result_format}"
            )

            # 调用便捷API
            result = image_to_3d(
                image=load_image_pil(image_path, preserve_alpha=True),
                output_path=output_path,
                format=result_format,
            )

            if result:
                return {
                    "success": True,
                    "output_path": output_path,
                }
            else:
                return {"success": False, "error": "便捷API生成失败"}

        except ImportError:
            logger.error("hy3dgen 未安装或API不可用")
            return {
                "success": False,
                "error": "hy3dgen 未安装。请安装: pip install hy3dgen"
            }
        except Exception as e:
            logger.error(f"便捷API调用失败: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    # ============================================================
    # 条件生成
    # ============================================================

    async def _process_condition_generate(self, task_id: str) -> Dict[str, Any]:
        """
        条件生成（兼容旧 API）：归一化为轨道A统一管线 image_to_3d。
        推荐新调用方直接使用 image-to-3d 并传入 setting_mesh_path + multi_view。
        """
        task = self.get_task(task_id)
        params = dict(task.params)
        params["image_path"] = params.get("design_image_path") or params.get(
            "image_path", ""
        )
        params.setdefault("multi_view", False)
        params.setdefault("views", params.get("views") or {})
        task.params = params
        return await self._process_image_to_3d(task_id)

    def _build_condition_prompt(
        self,
        prompt: str,
        gem_type: str,
        inlay_type: str,
        inlay_info: Optional[Dict] = None,
        point_cloud_features: Optional[Dict] = None,
    ) -> str:
        """
        构建条件生成的增强提示词
        结合镶嵌数据库信息优化生成效果
        """
        # 宝石类型映射
        gem_names = {
            "diamond": "钻石",
            "ruby": "红宝石",
            "sapphire": "蓝宝石",
            "emerald": "祖母绿",
            "amethyst": "紫水晶",
            "topaz": "托帕石",
            "opal": "欧泊",
            "pearl": "珍珠",
        }

        # 镶嵌类型映射
        inlay_names = {
            "prong": "爪镶",
            "bezel": "包镶",
            "pave": "密钉镶",
            "channel": "槽镶",
            "bar": "棒镶",
            "tension": "张力镶",
            "invisible": "隐形镶",
        }

        gem_cn = gem_names.get(gem_type, gem_type)
        inlay_cn = inlay_names.get(inlay_type, inlay_type)

        enhanced = f"{prompt}，{gem_cn}，{inlay_cn}"

        # 如果有镶嵌数据库的额外信息
        if inlay_info:
            if inlay_info.get("prong_count"):
                enhanced += f"，{inlay_info['prong_count']}爪"
            if inlay_info.get("setting_style"):
                enhanced += f"，{inlay_info['setting_style']}风格"

        if point_cloud_features:
            bbox = point_cloud_features.get("bbox")
            if bbox:
                enhanced += f"，底座尺寸约 {bbox[0]:.2f}x{bbox[1]:.2f}x{bbox[2]:.2f} 毫米"
            center = point_cloud_features.get("center")
            if center:
                enhanced += f"，底座中心 ({center[0]:.2f},{center[1]:.2f},{center[2]:.2f})"

        return enhanced

    async def _query_inlay_database(
        self, params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        查询镶嵌结构数据库
        根据镶嵌类型和宝石类型查找匹配的底座结构

        Returns:
            镶嵌结构信息字典，未找到返回None
        """
        config = get_config()
        inlay_db_path = config.service.inlay_db_path

        if not os.path.isdir(inlay_db_path):
            logger.debug(f"镶嵌数据库目录不存在: {inlay_db_path}")
            return None

        inlay_type = params.get("inlay_type", "")
        gem_type = params.get("gem_type", "")

        if not inlay_type:
            return None

        # 在镶嵌数据库中查找匹配的结构文件
        # 数据库目录结构示例:
        # 镶嵌结构数据库/
        #   ├── prong/           # 爪镶
        #   │   ├── 4prong.obj
        #   │   └── 6prong.obj
        #   ├── bezel/           # 包镶
        #   └── pave/            # 密钉镶

        inlay_dir = os.path.join(inlay_db_path, inlay_type)
        if os.path.isdir(inlay_dir):
            # 列出该类型下的所有结构文件
            files = [f for f in os.listdir(inlay_dir)
                     if f.endswith(('.obj', '.glb', '.stl'))]
            if files:
                info = {
                    "type": inlay_type,
                    "available_structures": files,
                    "directory": inlay_dir,
                }
                # 尝试推断爪数等信息
                import re
                for f in files:
                    match = re.search(r'(\d+)\s*prong', f, re.IGNORECASE)
                    if match:
                        info["prong_count"] = int(match.group(1))
                        break
                return info

        return None

    # ============================================================
    # 网格融合
    # ============================================================

    async def _process_mesh_fusion(self, task_id: str) -> Dict[str, Any]:
        """
        处理网格融合任务
        底座 + 生成结果 -> 完整模型
        """
        task = self.get_task(task_id)
        config = get_config()
        params = task.params

        cancelled = self._cancelled_response(task_id)
        if cancelled is not None:
            return cancelled

        # 验证输入
        self.update_task(task_id, progress=5, current_step="验证输入")

        base_mesh_path = params.get("base_mesh_path", "")
        generated_mesh_path = params.get("generated_mesh_path", "")

        if not validate_mesh_file(base_mesh_path):
            return {"success": False, "error": f"无效的底座网格: {base_mesh_path}"}
        if not validate_mesh_file(generated_mesh_path):
            return {"success": False, "error": f"无效的生成网格: {generated_mesh_path}"}

        fusion_method = params.get("fusion_method") or "colored_merge"
        output_format = params.get("output_format", "glb")
        enable_repair = params.get("enable_topology_repair", True)

        processor = get_mesh_processor()

        # 统一走 process_generated_mesh（分色合并会保留双网格颜色，避免整模 repair 冲掉）
        self.update_task(task_id, progress=20, current_step="网格融合与后处理")
        process_result = await asyncio.to_thread(
            processor.process_generated_mesh,
            generated_mesh_path=generated_mesh_path,
            base_mesh_path=base_mesh_path,
            output_dir=config.service.output_dir,
            task_id=task_id,
            fusion_method=fusion_method,
            enable_icp=True,
            enable_repair=enable_repair,
            output_format=output_format,
        )
        if not process_result.get("success"):
            return {
                "success": False,
                "error": process_result.get("error") or "网格融合失败",
            }

        output_path = process_result["output_path"]
        mesh_info = process_result.get("mesh_info") or {}

        self.update_task(task_id, progress=95, current_step="保存结果")

        return {
            "success": True,
            "output_path": output_path,
            "output_files": [output_path],
            "mesh_info": mesh_info,
            "region_colors": process_result.get("region_colors"),
            "steps_completed": process_result.get("steps_completed"),
        }


# 全局服务实例
_generator_instance: Optional[GeneratorService] = None


def get_generator_service() -> GeneratorService:
    """
    获取生成服务单例
    """
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = GeneratorService()
    return _generator_instance
