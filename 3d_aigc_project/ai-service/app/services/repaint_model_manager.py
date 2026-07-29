"""
InstructPix2Pix 重绘模型管理（lazy load / unload，与 Hunyuan3D 错峰占用 GPU）
"""

from __future__ import annotations

import gc
import logging
import os
import threading
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_PROMPT = (
    "make the gemstone matte and diffuse, remove specular highlights, "
    "keep facet structure and color, do not change metal or prongs"
)


class RepaintModelManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._pipeline: Any = None
        self._loaded = False
        self._load_lock = threading.Lock()

    def _resolve_model_path(self) -> str:
        from app.config import get_config

        cfg = get_config().gem_repaint
        raw = cfg.model_path
        candidate = Path(raw).expanduser()
        if not candidate.is_absolute():
            candidate = (Path.cwd() / candidate).resolve()
        return str(candidate)

    def _ensure_hunyuan_unloaded(self) -> None:
        from app.services.model_manager import get_model_manager

        mm = get_model_manager()
        if mm.is_loaded():
            logger.info("宝石重绘前卸载 Hunyuan3D 以释放显存")
            mm.unload_model()

    def load(self) -> bool:
        from app.config import get_config

        cfg = get_config().gem_repaint
        if not cfg.enabled:
            logger.warning("ENABLE_GEM_REPAINT=0，跳过重绘模型加载")
            return False

        with self._load_lock:
            if self._loaded and self._pipeline is not None:
                return True

            self._ensure_hunyuan_unloaded()

            try:
                import torch
                from diffusers import StableDiffusionInstructPix2PixPipeline
            except ImportError as e:
                logger.error("缺少 diffusers 依赖: %s", e)
                return False

            model_path = self._resolve_model_path()
            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32

            local_ok = (
                Path(model_path).is_dir()
                and any(Path(model_path).glob("**/model_index.json"))
            )

            try:
                if local_ok and get_config().model.offline_mode:
                    logger.info("从本地加载 InstructPix2Pix: %s", model_path)
                    self._pipeline = StableDiffusionInstructPix2PixPipeline.from_pretrained(
                        model_path,
                        torch_dtype=dtype,
                        local_files_only=True,
                    )
                elif local_ok:
                    self._pipeline = StableDiffusionInstructPix2PixPipeline.from_pretrained(
                        model_path,
                        torch_dtype=dtype,
                    )
                else:
                    hf_id = os.environ.get(
                        "GEM_REPAINT_HF_ID", "timbrooks/instruct-pix2pix"
                    )
                    logger.info("从 HuggingFace 加载 InstructPix2Pix: %s", hf_id)
                    self._pipeline = StableDiffusionInstructPix2PixPipeline.from_pretrained(
                        hf_id,
                        torch_dtype=dtype,
                    )

                self._pipeline.to(device)
                if device == "cuda":
                    try:
                        self._pipeline.enable_attention_slicing()
                    except Exception:
                        pass

                self._loaded = True
                logger.info("InstructPix2Pix 加载完成 (device=%s)", device)
                return True
            except Exception as e:
                logger.error("InstructPix2Pix 加载失败: %s", e, exc_info=True)
                self._pipeline = None
                self._loaded = False
                return False

    def unload(self) -> None:
        with self._load_lock:
            if self._pipeline is not None:
                try:
                    del self._pipeline
                except Exception:
                    pass
            self._pipeline = None
            self._loaded = False
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            logger.info("InstructPix2Pix 已卸载")

    def is_loaded(self) -> bool:
        return self._loaded and self._pipeline is not None

    def repaint(
        self,
        image,
        *,
        prompt: Optional[str] = None,
        strength: float = 0.45,
        seed: Optional[int] = None,
        num_inference_steps: int = 20,
        image_guidance_scale: float = 1.5,
        guidance_scale: float = 7.5,
    ):
        if not self.load():
            raise RuntimeError("InstructPix2Pix 模型未加载，请确认 ENABLE_GEM_REPAINT=1 且权重已下载")

        import torch

        generator = None
        if seed is not None:
            device = self._pipeline.device
            generator = torch.Generator(device=device).manual_seed(int(seed))

        result = self._pipeline(
            prompt=prompt or DEFAULT_PROMPT,
            image=image,
            num_inference_steps=num_inference_steps,
            image_guidance_scale=image_guidance_scale,
            guidance_scale=guidance_scale,
            generator=generator,
        )
        return result.images[0]


def get_repaint_model_manager() -> RepaintModelManager:
    return RepaintModelManager()
