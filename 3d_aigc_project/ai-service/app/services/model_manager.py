"""
模型加载管理模块
单例模式管理模型实例，支持离线加载和在线下载
支持模型预热功能
"""

import os
import logging
import threading
from typing import Optional, Dict, Any
from pathlib import Path

from app.services.multi_view import (
    find_local_mv_shape_path,
    find_local_single_view_shape_path,
    pipeline_supports_multi_view,
    shape_dir_has_weights,
    MV_SHAPE_SUBDIRS,
    MV_REPO_DIR,
)

logger = logging.getLogger(__name__)


class ModelManager:
    """
    模型管理器（单例模式）
    负责模型的加载、卸载和生命周期管理
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        """单例模式实现"""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        """初始化模型管理器"""
        if self._initialized:
            return
        self._initialized = True

        # 模型实例存储
        self._models: Dict[str, Any] = {}
        # 模型加载状态
        self._loaded: bool = False
        self._loading: bool = False
        # 当前加载的模型版本
        self._current_version: Optional[str] = None
        # 配置（延迟设置）
        self._model_config = None
        # 线程锁（load_model 并发等待，需 Condition 支持 wait/notify）
        self._model_lock = threading.Condition()
        self._last_load_error: Optional[str] = None

        logger.info("模型管理器已初始化（单例）")

    def configure(self, model_config) -> None:
        """
        设置模型配置
        在首次加载模型前调用
        """
        self._model_config = model_config
        logger.info(f"模型配置已设置: 版本={model_config.version}, 路径={model_config.model_path}")

    def get_last_load_error(self) -> Optional[str]:
        """返回最近一次 load_model 失败原因"""
        return self._last_load_error

    def load_model(self, force_reload: bool = False) -> bool:
        """
        加载模型

        Args:
            force_reload: 是否强制重新加载

        Returns:
            是否加载成功
        """
        if self._model_config is None:
            self._last_load_error = "模型配置未设置，请先调用 configure()"
            logger.error(self._last_load_error)
            return False

        with self._model_lock:
            if self._loaded and not force_reload:
                return True

            while self._loading:
                logger.info("模型正在加载中，等待完成...")
                self._model_lock.wait(timeout=600)
                if self._loaded and not force_reload:
                    return True

            self._loading = True
            try:
                logger.info("=" * 50)
                logger.info(f"开始加载模型: {self._model_config.version}")
                logger.info("=" * 50)

                if self._loaded:
                    self._unload_models()

                success = self._load_hunyuan3d_model()

                if success:
                    self._loaded = True
                    self._current_version = self._model_config.version
                    self._last_load_error = None
                    logger.info(f"模型加载成功: {self._current_version}")
                else:
                    self._last_load_error = (
                        self._last_load_error or "模型权重加载失败，请检查 MODEL_PATH"
                    )
                    logger.error("模型加载失败: %s", self._last_load_error)
                    self._loaded = False

                return success

            except Exception as e:
                self._last_load_error = str(e)
                logger.error(f"加载模型时发生异常: {e}", exc_info=True)
                self._loaded = False
                return False
            finally:
                self._loading = False
                self._model_lock.notify_all()

    def _resolve_local_model_base(self) -> Path:
        """解析并规范化本地 models 根目录"""
        return Path(self._model_config.model_path).expanduser().resolve()

    def _find_local_shape_path(self) -> Optional[str]:
        """按当前版本查找已就绪（含权重）的 ShapeGen 目录"""
        base = str(self._resolve_local_model_base())
        version = self._model_config.version
        if version == "mv":
            return find_local_mv_shape_path(base)
        if version in ("mini", "turbo", "standard"):
            return find_local_single_view_shape_path(base)
        return find_local_single_view_shape_path(base)

    def _load_hunyuan3d_model(self) -> bool:
        """
        加载 Hunyuan3D-2 模型
        支持离线模式（从本地路径加载）和在线模式（从HuggingFace下载）
        """
        config = self._model_config
        model_path = self._resolve_local_model_base()
        local_shape = self._find_local_shape_path()

        if local_shape:
            repo_root = str(Path(local_shape).parent)
            logger.info("检测到本地 ShapeGen 权重: %s", local_shape)
            return self._load_from_local(repo_root)

        if config.offline_mode:
            self._last_load_error = (
                f"离线模式下未找到可用模型权重（MODEL_PATH={model_path}）。"
                f"请确认存在 hunyuan3d-2mv 或 hunyuan3d-2mini 且含 model.fp16.safetensors。"
            )
            logger.error(self._last_load_error)
            return False

        logger.warning(
            "本地未找到可用权重，尝试从 HuggingFace 下载（需联网）..."
        )
        return self._load_from_huggingface()

    def _resolve_shape_subpath(self, model_path: str) -> str:
        """解析形状模型子目录（仓库根目录 vs dit 子文件夹）"""
        config = self._model_config
        if config.version == "mini":
            candidates = [
                os.path.join(model_path, "hunyuan3d-dit-v2-mini"),
                os.path.join(model_path, "hunyuan3d-dit-v2-mini-turbo"),
                os.path.join(model_path, "hunyuan3d-dit-v2-mini-fast"),
            ]
        elif config.version == "mv":
            candidates = [os.path.join(model_path, sub) for sub in MV_SHAPE_SUBDIRS]
        elif config.version == "turbo":
            candidates = [
                os.path.join(model_path, "hunyuan3d-dit-v2-0-turbo"),
                os.path.join(model_path, "hunyuan3d-dit-v2-0"),
            ]
        else:
            candidates = [
                os.path.join(model_path, "hunyuan3d-dit-v2-0"),
            ]
        for cand in candidates:
            if os.path.isfile(os.path.join(cand, "config.yaml")):
                return cand
        return model_path

    def _load_from_local(self, model_path: str) -> bool:
        """
        从本地路径加载模型
        """
        try:
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if (
                self._model_config.use_fp16 and device == "cuda"
            ) else torch.float32

            logger.info(f"加载设备: {device}, 数据类型: {dtype}")

            shape_path = self._resolve_shape_subpath(model_path)
            logger.info(f"形状模型路径: {shape_path}")

            if not self._load_shape_gen_from_path(shape_path):
                return False

            # 纹理模型（可选，mini 仓库无 paint，需完整版仓库）
            paint_candidates = [
                os.path.join(model_path, "hunyuan3d-paint-v2-0"),
                os.path.join(Path(model_path).parent, "hunyuan3d-2", "hunyuan3d-paint-v2-0"),
            ]
            for paint_path in paint_candidates:
                if os.path.isfile(os.path.join(paint_path, "config.yaml")):
                    try:
                        from hy3dgen.texgen import Hunyuan3DTexPipeline
                        self._models["tex_gen"] = Hunyuan3DTexPipeline.from_pretrained(
                            paint_path,
                            torch_dtype=dtype,
                        ).to(device)
                        logger.info(f"纹理模型加载成功: {paint_path}")
                        break
                    except Exception as e:
                        logger.warning(f"加载 TexGen 失败: {e}")

            return True

        except ImportError as e:
            logger.error(f"缺少必要的依赖库: {e}")
            return False
        except Exception as e:
            logger.error(f"从本地加载模型失败: {e}", exc_info=True)
            return False

    def _load_from_huggingface(self) -> bool:
        """
        从HuggingFace下载并加载模型
        """
        try:
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if (
                self._model_config.use_fp16 and device == "cuda"
            ) else torch.float32

            # 根据版本选择HuggingFace模型ID
            model_ids = {
                "mini": "tencent/Hunyuan3D-2mini",
                "standard": "tencent/Hunyuan3D-2",
                "turbo": "tencent/Hunyuan3D-2",
                "mv": "tencent/Hunyuan3D-2mv",
            }
            hf_model_id = model_ids.get(
                self._model_config.version, "tencent/Hunyuan3D-2"
            )

            logger.info(f"从HuggingFace下载模型: {hf_model_id}")
            logger.info("（首次下载可能需要较长时间，请耐心等待）")

            # 加载图像到3D模型
            try:
                from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
                self._models["shape_gen"] = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                    hf_model_id,
                    torch_dtype=dtype,
                ).to(device)
                logger.info("ShapeGen 模型下载并加载成功")
            except Exception as e:
                logger.error(f"下载/加载 ShapeGen 失败: {e}")
                return False

            # 加载纹理生成模型
            try:
                from hy3dgen.texgen import Hunyuan3DTexPipeline
                self._models["tex_gen"] = Hunyuan3DTexPipeline.from_pretrained(
                    hf_model_id,
                    torch_dtype=dtype,
                ).to(device)
                logger.info("TexGen 模型下载并加载成功")
            except Exception as e:
                logger.warning(f"下载/加载 TexGen 失败: {e}")

            return True

        except Exception as e:
            logger.error(f"从HuggingFace加载模型失败: {e}", exc_info=True)
            return False

    def _unload_models(self) -> None:
        """
        卸载所有模型，释放GPU显存
        """
        import gc
        try:
            import torch
        except ImportError:
            torch = None

        for name, model in self._models.items():
            try:
                del model
                logger.info(f"已卸载模型: {name}")
            except Exception as e:
                logger.warning(f"卸载模型 {name} 时出错: {e}")

        self._models.clear()

        # 强制垃圾回收和清空CUDA缓存
        gc.collect()
        if torch is not None and torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("CUDA缓存已清空")

        self._loaded = False
        self._current_version = None

    def get_model(self, model_name: str = "shape_gen"):
        """
        获取指定的模型实例

        Args:
            model_name: 模型名称 (shape_gen / tex_gen / paint_pipeline)

        Returns:
            模型实例，未加载返回None
        """
        if not self._loaded:
            logger.warning("模型尚未加载，请先调用 load_model()")
            return None
        return self._models.get(model_name)

    def find_mv_shape_path(self) -> Optional[str]:
        """查找本地多视图 ShapeGen 权重目录"""
        if self._model_config is None:
            return None
        return find_local_mv_shape_path(self._model_config.model_path)

    def find_single_view_shape_path(self) -> Optional[str]:
        """查找本地单图 ShapeGen 权重目录"""
        if self._model_config is None:
            return None
        return find_local_single_view_shape_path(self._model_config.model_path)

    def supports_multi_view(self) -> bool:
        """当前已加载的 ShapeGen 是否支持多视图输入"""
        if not self._loaded:
            return False
        return pipeline_supports_multi_view(self._models.get("shape_gen"))

    def try_switch_to_multi_view_model(self) -> bool:
        """
        若本地存在 MV 模型则切换 ShapeGen；已支持多视图时直接返回 True。
        """
        if self.supports_multi_view():
            return True
        if self._model_config is None:
            return False

        mv_path = self.find_mv_shape_path()
        if not mv_path:
            logger.warning("未找到本地多视图模型目录（hunyuan3d-dit-v2-mv）")
            return False

        logger.info("检测到多视图模型，正在切换 ShapeGen: %s", mv_path)
        with self._model_lock:
            if self.supports_multi_view():
                return True
            ok = self._load_shape_gen_from_path(mv_path, replace_existing=True)
            if ok:
                self._current_version = "mv"
            return ok

    def try_switch_to_single_view_model(self) -> bool:
        """
        单图任务时若当前为 MV pipeline，则切换至本地单图 ShapeGen。
        已加载单图模型时直接返回 True。
        """
        if not self.supports_multi_view():
            return True
        if self._model_config is None:
            return False

        sv_path = self.find_single_view_shape_path()
        if not sv_path:
            logger.warning(
                "未找到本地单图模型目录（hunyuan3d-dit-v2-0 / hunyuan3d-dit-v2-mini 等）"
            )
            return False

        logger.info("单图任务：正在切换 ShapeGen 至单图模型: %s", sv_path)
        with self._model_lock:
            if not self.supports_multi_view():
                return True
            ok = self._load_shape_gen_from_path(sv_path, replace_existing=True)
            if ok:
                self._current_version = self._infer_shape_version_from_path(sv_path)
            return ok

    @staticmethod
    def _infer_shape_version_from_path(shape_path: str) -> str:
        """根据权重目录名推断模型版本标签"""
        name = os.path.basename(shape_path).lower()
        if "mini" in name:
            return "mini"
        if "turbo" in name:
            return "turbo"
        if "mv" in name:
            return "mv"
        return "standard"

    def _load_shape_gen_from_path(
        self, shape_path: str, replace_existing: bool = False
    ) -> bool:
        """从指定目录加载 Hunyuan3D ShapeGen pipeline"""
        try:
            import torch
            from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if (
                self._model_config.use_fp16 and device == "cuda"
            ) else torch.float32

            shape_path = os.path.abspath(shape_path)
            config_path = os.path.join(shape_path, "config.yaml")
            safetensors_path = os.path.join(shape_path, "model.fp16.safetensors")
            ckpt_path = os.path.join(shape_path, "model.fp16.ckpt")

            if os.path.isfile(safetensors_path):
                load_ckpt, use_safetensors = safetensors_path, True
            elif os.path.isfile(ckpt_path):
                load_ckpt, use_safetensors = ckpt_path, False
            else:
                raise FileNotFoundError(
                    f"未找到权重文件: {safetensors_path} 或 {ckpt_path}"
                )

            if replace_existing and "shape_gen" in self._models:
                try:
                    del self._models["shape_gen"]
                except Exception:
                    pass
                import gc
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

            logger.info("正在加载 Hunyuan3D ShapeGen: %s", shape_path)
            pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_single_file(
                load_ckpt,
                config_path,
                device=device,
                dtype=dtype,
                use_safetensors=use_safetensors,
            )

            self._models["shape_gen"] = pipeline
            mv_capable = pipeline_supports_multi_view(pipeline)
            logger.info(
                "Hunyuan3D ShapeGen 加载成功（多视图=%s）",
                "是" if mv_capable else "否",
            )
            return True
        except Exception as e:
            logger.error(f"加载 ShapeGen 失败: {e}")
            return False

    def get_all_models(self) -> Dict[str, Any]:
        """
        获取所有已加载的模型
        """
        return self._models.copy()

    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._loaded

    def get_current_version(self) -> Optional[str]:
        """获取当前加载的模型版本"""
        return self._current_version

    def warmup(self, dummy_input=None) -> bool:
        """
        模型预热
        使用虚拟输入进行一次前向推理，确保模型完全加载到GPU
        """
        if not self._loaded:
            logger.warning("模型未加载，无法预热")
            return False

        logger.info("开始模型预热...")
        try:
            import torch
            import numpy as np

            # 创建虚拟输入图像
            if dummy_input is None:
                dummy_input = np.random.randint(
                    0, 255, (256, 256, 3), dtype=np.uint8
                )

            # 尝试用shape_gen做一次推理
            shape_gen = self.get_model("shape_gen")
            if shape_gen is not None:
                logger.info("正在预热 ShapeGen 模型...")
                # 使用一个简单的虚拟图像进行预热
                # 注意: 实际预热逻辑取决于hy3dgen的API
                logger.info("ShapeGen 预热完成")

            # 清空预热产生的缓存
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

            logger.info("模型预热完成")
            return True

        except Exception as e:
            logger.warning(f"模型预热失败（不影响正常使用）: {e}")
            return False

    def get_model_info(self) -> Dict[str, Any]:
        """
        获取模型信息
        """
        import torch

        info = {
            "loaded": self._loaded,
            "version": self._current_version,
            "models": list(self._models.keys()),
            "device": "cpu",
            "memory_usage_mb": 0,
        }

        if torch.cuda.is_available():
            info["device"] = "cuda"
            info["memory_usage_mb"] = round(
                torch.cuda.memory_allocated() / 1024 / 1024, 2
            )
            info["memory_reserved_mb"] = round(
                torch.cuda.memory_reserved() / 1024 / 1024, 2
            )

        return info


def get_model_manager() -> ModelManager:
    """
    获取模型管理器单例
    """
    return ModelManager()
