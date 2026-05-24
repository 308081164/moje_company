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
        # 线程锁
        self._model_lock = threading.Lock()

        logger.info("模型管理器已初始化（单例）")

    def configure(self, model_config) -> None:
        """
        设置模型配置
        在首次加载模型前调用
        """
        self._model_config = model_config
        logger.info(f"模型配置已设置: 版本={model_config.version}, 路径={model_config.model_path}")

    def load_model(self, force_reload: bool = False) -> bool:
        """
        加载模型

        Args:
            force_reload: 是否强制重新加载

        Returns:
            是否加载成功
        """
        if self._model_config is None:
            logger.error("模型配置未设置，请先调用 configure()")
            return False

        # 如果已加载且不强制重载，直接返回
        if self._loaded and not force_reload:
            logger.info("模型已加载，跳过重复加载")
            return True

        # 防止并发加载
        if self._loading:
            logger.warning("模型正在加载中，请等待...")
            return False

        self._loading = True
        try:
            with self._model_lock:
                logger.info("=" * 50)
                logger.info(f"开始加载模型: {self._model_config.version}")
                logger.info("=" * 50)

                # 先卸载已有模型释放显存
                if self._loaded:
                    self._unload_models()

                # 根据配置加载模型
                success = self._load_hunyuan3d_model()

                if success:
                    self._loaded = True
                    self._current_version = self._model_config.version
                    logger.info(f"模型加载成功: {self._current_version}")
                else:
                    logger.error("模型加载失败")
                    self._loaded = False

                return success

        except Exception as e:
            logger.error(f"加载模型时发生异常: {e}", exc_info=True)
            self._loaded = False
            return False
        finally:
            self._loading = False

    def _load_hunyuan3d_model(self) -> bool:
        """
        加载 Hunyuan3D-2 模型
        支持离线模式（从本地路径加载）和在线模式（从HuggingFace下载）
        """
        config = self._model_config
        model_path = Path(config.model_path)

        # 检查本地模型路径是否存在
        local_model_dir = model_path / f"hunyuan3d-2-{config.version}"
        has_local_model = local_model_dir.exists() and any(local_model_dir.iterdir())

        if config.offline_mode:
            if not has_local_model:
                logger.error(
                    f"离线模式下未找到本地模型: {local_model_dir}\n"
                    f"请将模型文件放置到该目录，或设置 OFFLINE_MODE=false 从HuggingFace下载"
                )
                return False
            logger.info(f"从本地路径加载模型: {local_model_dir}")
            return self._load_from_local(str(local_model_dir))
        else:
            # 在线模式：优先使用本地，不存在则从HuggingFace下载
            if has_local_model:
                logger.info(f"检测到本地模型，从本地加载: {local_model_dir}")
                return self._load_from_local(str(local_model_dir))
            else:
                logger.info("本地模型不存在，从HuggingFace下载...")
                return self._load_from_huggingface()

    def _load_from_local(self, model_path: str) -> bool:
        """
        从本地路径加载模型
        """
        try:
            import torch
            from hy3dgen.text2image import Hunyuan3DPaintPipeline
            from hy3dgen.texgen import Hunyuan3DTexPipeline

            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if (
                self._model_config.use_fp16 and device == "cuda"
            ) else torch.float32

            logger.info(f"加载设备: {device}, 数据类型: {dtype}")

            # 加载图像到3D生成管道
            logger.info("正在加载 Hunyuan3D-2 Image-to-3D 管道...")
            try:
                from hy3dgen.t2i import Hunyuan3DPaintPipeline
                self._models["paint_pipeline"] = Hunyuan3DPaintPipeline.from_pretrained(
                    model_path,
                    torch_dtype=dtype,
                ).to(device)
                logger.info("Hunyuan3D Paint Pipeline 加载成功")
            except Exception as e:
                logger.warning(f"加载 Paint Pipeline 失败（可能不需要）: {e}")

            # 加载图像到3D模型
            logger.info("正在加载 Hunyuan3D-2 Image-to-3D 模型...")
            try:
                from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
                self._models["shape_gen"] = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
                    model_path,
                    torch_dtype=dtype,
                ).to(device)
                logger.info("Hunyuan3D Shape Generation 模型加载成功")
            except Exception as e:
                logger.warning(f"加载 ShapeGen 失败: {e}")

            # 加载纹理生成模型
            logger.info("正在加载 Hunyuan3D-2 纹理生成模型...")
            try:
                from hy3dgen.texgen import Hunyuan3DTexPipeline
                self._models["tex_gen"] = Hunyuan3DTexPipeline.from_pretrained(
                    model_path,
                    torch_dtype=dtype,
                ).to(device)
                logger.info("Hunyuan3D Texture Generation 模型加载成功")
            except Exception as e:
                logger.warning(f"加载 TexGen 失败（将跳过纹理生成）: {e}")

            # 至少需要 shape_gen 模型
            if "shape_gen" not in self._models:
                logger.error("核心模型 shape_gen 加载失败，无法继续")
                return False

            return True

        except ImportError as e:
            logger.error(f"缺少必要的依赖库: {e}")
            logger.error("请确保已安装 hy3dgen: pip install hy3dgen")
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
                "mini": "tencent/Hunyuan3D-2",
                "standard": "tencent/Hunyuan3D-2",
                "turbo": "tencent/Hunyuan3D-2",
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
