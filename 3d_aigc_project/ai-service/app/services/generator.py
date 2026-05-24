"""
3D生成核心服务模块
调用Hunyuan3D-2进行图片到3D生成
支持点云条件输入、异步任务队列
"""

import os
import asyncio
import logging
import time
from typing import Optional, Dict, Any, Callable
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
)
from app.config import get_config

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
        # 任务回调函数
        self._callbacks: Dict[str, Callable] = {}
        # 信号量控制并发数
        self._semaphore: Optional[asyncio.Semaphore] = None
        # 是否已初始化
        self._initialized = False

    def initialize(self):
        """
        初始化服务
        在应用启动时调用
        """
        config = get_config()
        self._semaphore = asyncio.Semaphore(config.service.max_concurrent_tasks)
        self._initialized = True
        logger.info(
            f"生成服务已初始化，最大并发任务数: {config.service.max_concurrent_tasks}"
        )

    # ============================================================
    # 任务管理
    # ============================================================

    def create_task(
        self,
        request_type: str,
        params: Dict[str, Any],
    ) -> TaskInfo:
        """
        创建新的生成任务

        Args:
            request_type: 请求类型 (image_to_3d / condition_generate / mesh_fusion)
            params: 请求参数

        Returns:
            TaskInfo 任务信息
        """
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

    # ============================================================
    # 异步任务执行
    # ============================================================

    async def submit_task(self, task_id: str):
        """
        提交任务到异步队列
        使用信号量控制并发数
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

        # 在后台执行任务
        asyncio.create_task(self._execute_task(task_id))

    async def _execute_task(self, task_id: str):
        """
        执行任务（带并发控制）
        """
        async with self._semaphore:
            task = self.get_task(task_id)
            if task is None:
                return

            start_time = time.time()

            try:
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

                if result.get("success"):
                    self.update_task(
                        task_id,
                        status=TaskStatus.COMPLETED,
                        progress=100,
                        message="任务完成",
                        result_url=result.get("output_path"),
                        result_files=result.get("output_files", []),
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

    # ============================================================
    # 图片到3D生成
    # ============================================================

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

        # 步骤1: 验证输入
        self.update_task(task_id, progress=5, current_step="验证输入")
        image_path = params.get("image_path", "")

        if not validate_image_file(image_path):
            return {"success": False, "error": f"无效的图像文件: {image_path}"}

        # 验证可选的底座网格
        setting_mesh_path = params.get("setting_mesh_path")
        if setting_mesh_path and not validate_mesh_file(setting_mesh_path):
            logger.warning(f"底座网格无效，将跳过融合: {setting_mesh_path}")
            setting_mesh_path = None

        # 步骤2: 确保模型已加载
        self.update_task(task_id, progress=10, current_step="加载模型")
        model_manager = get_model_manager()

        if not model_manager.is_loaded():
            logger.info("模型未加载，开始加载...")
            # 在线程池中加载模型（避免阻塞事件循环）
            loaded = await asyncio.to_thread(model_manager.load_model)
            if not loaded:
                return {"success": False, "error": "模型加载失败"}

        # 步骤3: 调用Hunyuan3D-2生成3D
        self.update_task(task_id, progress=20, current_step="3D模型生成中")

        prompt = params.get("prompt", "")
        negative_prompt = params.get("negative_prompt", "")
        result_format = params.get("result_format", "glb")

        # 在线程池中执行模型推理（CPU/GPU密集型任务）
        gen_result = await asyncio.to_thread(
            self._run_hunyuan3d_generation,
            image_path=image_path,
            prompt=prompt,
            negative_prompt=negative_prompt,
            output_dir=config.service.output_dir,
            task_id=task_id,
            result_format=result_format,
        )

        if not gen_result.get("success"):
            return gen_result

        self.update_task(task_id, progress=70, current_step="后处理")

        generated_mesh = gen_result["output_path"]

        # 步骤4: 后处理（与底座融合）
        output_files = [generated_mesh]

        if setting_mesh_path:
            self.update_task(task_id, progress=75, current_step="网格融合")
            processor = get_mesh_processor()
            process_result = await asyncio.to_thread(
                processor.process_generated_mesh,
                generated_mesh_path=generated_mesh,
                base_mesh_path=setting_mesh_path,
                output_dir=config.service.output_dir,
                task_id=task_id,
                fusion_method="boolean",
                enable_icp=True,
                enable_repair=True,
                output_format=result_format,
            )
            if process_result.get("success"):
                generated_mesh = process_result["output_path"]
                output_files.append(generated_mesh)

        self.update_task(task_id, progress=95, current_step="保存结果")

        return {
            "success": True,
            "output_path": generated_mesh,
            "output_files": output_files,
        }

    def _run_hunyuan3d_generation(
        self,
        image_path: str,
        prompt: str = "",
        negative_prompt: str = "",
        output_dir: str = "./outputs/",
        task_id: str = "",
        result_format: str = "glb",
    ) -> Dict[str, Any]:
        """
        执行Hunyuan3D-2图片到3D生成

        在线程中运行，避免阻塞事件循环
        """
        model_manager = get_model_manager()
        config = get_config()

        try:
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
            import trimesh

            logger.info(f"开始Hunyuan3D-2生成: image={image_path}")

            # 获取模型
            shape_gen = model_manager.get_model("shape_gen")
            if shape_gen is None:
                # 尝试直接使用hy3dgen的便捷API
                logger.info("使用hy3dgen便捷API进行生成...")
                return self._run_hy3dgen_simple(
                    image_path, prompt, output_dir, task_id, result_format
                )

            # 生成输出路径
            raw_output_path = generate_output_path(
                output_dir, task_id, f"raw_mesh.obj"
            )

            # 执行3D生成
            logger.info("正在生成3D网格...")
            images = [image_path]

            # 使用模型生成
            mesh_objects = shape_gen(images)

            if mesh_objects and len(mesh_objects) > 0:
                mesh = mesh_objects[0]

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

                # 转换为目标格式
                final_path = generate_output_path(
                    output_dir, task_id, f"generated.{result_format}"
                )
                if raw_output_path != final_path:
                    processor = get_mesh_processor()
                    final_path = processor.convert_format(
                        raw_output_path, final_path
                    )

                return {
                    "success": True,
                    "output_path": final_path,
                    "raw_path": raw_output_path,
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
                image_path=image_path,
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
        处理条件生成任务
        设计图 + 镶嵌底座 -> 珠宝3D模型

        流程:
        1. 验证设计图和底座网格
        2. 查询镶嵌结构数据库
        3. 生成宝石/装饰3D模型
        4. ICP对齐
        5. 布尔融合
        6. 拓扑修复
        7. 保存结果
        """
        task = self.get_task(task_id)
        config = get_config()
        params = task.params

        # 步骤1: 验证输入
        self.update_task(task_id, progress=5, current_step="验证输入")

        design_image_path = params.get("design_image_path", "")
        setting_mesh_path = params.get("setting_mesh_path", "")

        if not validate_image_file(design_image_path):
            return {"success": False, "error": f"无效的设计图: {design_image_path}"}
        if not validate_mesh_file(setting_mesh_path):
            return {"success": False, "error": f"无效的底座网格: {setting_mesh_path}"}

        # 步骤2: 查询镶嵌结构数据库
        self.update_task(task_id, progress=10, current_step="查询镶嵌数据库")
        inlay_info = await self._query_inlay_database(params)
        if inlay_info:
            logger.info(f"找到镶嵌结构信息: {inlay_info.get('type', 'unknown')}")

        # 步骤3: 确保模型已加载
        self.update_task(task_id, progress=15, current_step="加载模型")
        model_manager = get_model_manager()

        if not model_manager.is_loaded():
            loaded = await asyncio.to_thread(model_manager.load_model)
            if not loaded:
                return {"success": False, "error": "模型加载失败"}

        # 步骤4: 生成宝石/装饰3D模型
        self.update_task(task_id, progress=20, current_step="生成装饰3D模型")

        prompt = params.get("prompt", "珠宝装饰")
        gem_type = params.get("gem_type", "diamond")
        inlay_type = params.get("inlay_type", "prong")

        # 构建增强提示词
        enhanced_prompt = self._build_condition_prompt(
            prompt=prompt,
            gem_type=gem_type,
            inlay_type=inlay_type,
            inlay_info=inlay_info,
        )

        gen_result = await asyncio.to_thread(
            self._run_hunyuan3d_generation,
            image_path=design_image_path,
            prompt=enhanced_prompt,
            output_dir=config.service.output_dir,
            task_id=task_id,
            result_format=params.get("result_format", "glb"),
        )

        if not gen_result.get("success"):
            return gen_result

        generated_mesh = gen_result["output_path"]

        # 步骤5: ICP对齐
        self.update_task(task_id, progress=60, current_step="ICP点云对齐")

        enable_icp = params.get("enable_icp_alignment", True)
        processor = get_mesh_processor()

        if enable_icp and processor._open3d_available:
            try:
                aligned_path = generate_output_path(
                    config.service.output_dir, task_id, "aligned.obj"
                )
                transform, rmse = await asyncio.to_thread(
                    processor.icp_align,
                    generated_mesh, setting_mesh_path,
                )
                generated_mesh = await asyncio.to_thread(
                    processor.apply_icp_transform,
                    generated_mesh, transform, aligned_path,
                )
                logger.info(f"ICP对齐完成, RMSE={rmse:.6f}")
            except Exception as e:
                logger.warning(f"ICP对齐失败，跳过: {e}")

        # 步骤6: 布尔融合
        self.update_task(task_id, progress=75, current_step="布尔融合")

        enable_fusion = params.get("enable_mesh_fusion", True)
        if enable_fusion:
            try:
                fused_path = generate_output_path(
                    config.service.output_dir, task_id,
                    f"fused.{params.get('result_format', 'glb')}"
                )
                generated_mesh = await asyncio.to_thread(
                    processor.boolean_union,
                    setting_mesh_path, generated_mesh, fused_path,
                )
            except Exception as e:
                logger.warning(f"布尔融合失败，使用简单合并: {e}")
                merged_path = generate_output_path(
                    config.service.output_dir, task_id, "merged.glb"
                )
                import trimesh
                mesh_a = trimesh.load(setting_mesh_path)
                mesh_b = trimesh.load(generated_mesh)
                if isinstance(mesh_a, trimesh.Scene):
                    mesh_a = mesh_a.dump(concatenate=True)
                if isinstance(mesh_b, trimesh.Scene):
                    mesh_b = mesh_b.dump(concatenate=True)
                merged = processor._simple_merge(mesh_a, mesh_b)
                merged.export(merged_path)
                generated_mesh = merged_path

        # 步骤7: 拓扑修复
        self.update_task(task_id, progress=90, current_step="拓扑修复")
        try:
            repaired_path = generate_output_path(
                config.service.output_dir, task_id,
                f"final.{params.get('result_format', 'glb')}"
            )
            repair_stats = await asyncio.to_thread(
                processor.repair_mesh, generated_mesh, repaired_path
            )
            generated_mesh = repaired_path
        except Exception as e:
            logger.warning(f"拓扑修复失败: {e}")

        self.update_task(task_id, progress=95, current_step="保存结果")

        return {
            "success": True,
            "output_path": generated_mesh,
            "output_files": [generated_mesh],
        }

    def _build_condition_prompt(
        self,
        prompt: str,
        gem_type: str,
        inlay_type: str,
        inlay_info: Optional[Dict] = None,
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

        # 验证输入
        self.update_task(task_id, progress=5, current_step="验证输入")

        base_mesh_path = params.get("base_mesh_path", "")
        generated_mesh_path = params.get("generated_mesh_path", "")

        if not validate_mesh_file(base_mesh_path):
            return {"success": False, "error": f"无效的底座网格: {base_mesh_path}"}
        if not validate_mesh_file(generated_mesh_path):
            return {"success": False, "error": f"无效的生成网格: {generated_mesh_path}"}

        fusion_method = params.get("fusion_method", "boolean")
        output_format = params.get("output_format", "glb")
        enable_repair = params.get("enable_topology_repair", True)

        processor = get_mesh_processor()

        # 步骤1: ICP对齐
        self.update_task(task_id, progress=15, current_step="ICP对齐")
        if processor._open3d_available:
            try:
                aligned_path = generate_output_path(
                    config.service.output_dir, task_id, "aligned.obj"
                )
                transform, rmse = await asyncio.to_thread(
                    processor.icp_align,
                    generated_mesh_path, base_mesh_path,
                    max_iterations=params.get("icp_iterations", 50),
                )
                generated_mesh_path = await asyncio.to_thread(
                    processor.apply_icp_transform,
                    generated_mesh_path, transform, aligned_path,
                )
            except Exception as e:
                logger.warning(f"ICP对齐失败: {e}")

        # 步骤2: 布尔融合
        self.update_task(task_id, progress=40, current_step="布尔融合")
        output_path = generate_output_path(
            config.service.output_dir, task_id, f"fused.{output_format}"
        )

        try:
            if fusion_method == "boolean":
                output_path = await asyncio.to_thread(
                    processor.boolean_union,
                    base_mesh_path, generated_mesh_path, output_path,
                )
            elif fusion_method == "icp_merge":
                # ICP对齐后简单合并
                import trimesh
                mesh_a = trimesh.load(base_mesh_path)
                mesh_b = trimesh.load(generated_mesh_path)
                if isinstance(mesh_a, trimesh.Scene):
                    mesh_a = mesh_a.dump(concatenate=True)
                if isinstance(mesh_b, trimesh.Scene):
                    mesh_b = mesh_b.dump(concatenate=True)
                merged = processor._simple_merge(mesh_a, mesh_b)
                merged.export(output_path)
            else:
                # 简单合并
                import trimesh
                mesh_a = trimesh.load(base_mesh_path)
                mesh_b = trimesh.load(generated_mesh_path)
                if isinstance(mesh_a, trimesh.Scene):
                    mesh_a = mesh_a.dump(concatenate=True)
                if isinstance(mesh_b, trimesh.Scene):
                    mesh_b = mesh_b.dump(concatenate=True)
                merged = processor._simple_merge(mesh_a, mesh_b)
                merged.export(output_path)
        except Exception as e:
            logger.error(f"融合失败: {e}", exc_info=True)
            return {"success": False, "error": f"网格融合失败: {e}"}

        # 步骤3: 拓扑修复
        if enable_repair:
            self.update_task(task_id, progress=70, current_step="拓扑修复")
            try:
                repaired_path = generate_output_path(
                    config.service.output_dir, task_id, f"final.{output_format}"
                )
                repair_stats = await asyncio.to_thread(
                    processor.repair_mesh, output_path, repaired_path
                )
                output_path = repaired_path
            except Exception as e:
                logger.warning(f"拓扑修复失败: {e}")

        # 步骤4: 分析结果
        self.update_task(task_id, progress=90, current_step="分析结果")
        mesh_info = {}
        try:
            mesh_info = await asyncio.to_thread(
                processor.analyze_mesh, output_path
            )
        except Exception as e:
            logger.warning(f"网格分析失败: {e}")

        self.update_task(task_id, progress=95, current_step="保存结果")

        return {
            "success": True,
            "output_path": output_path,
            "output_files": [output_path],
            "mesh_info": mesh_info,
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
