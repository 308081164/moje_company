"""
应用配置模块
硬件自适应配置，根据GPU显存自动选择合适的模型版本
支持通过环境变量覆盖默认配置
"""

import os
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from app.utils.hardware import detect_gpu, get_recommended_model, GPUInfo, ModelRecommendation

logger = logging.getLogger(__name__)

# ============================================================
# 环境变量名称定义
# ============================================================
ENV_MODEL_VERSION = "MODEL_VERSION"           # 强制指定模型版本: mini / standard / turbo / mv
ENV_MODEL_PATH = "MODEL_PATH"                 # 模型本地存放路径
ENV_INLAY_DB_PATH = "INLAY_DB_PATH"           # 镶嵌结构数据库路径
ENV_OUTPUT_DIR = "OUTPUT_DIR"                 # 输出文件目录
ENV_CUDA_DEVICE = "CUDA_VISIBLE_DEVICES"      # 指定使用的GPU
ENV_HOST = "SERVICE_HOST"                     # 服务监听地址
ENV_PORT = "SERVICE_PORT"                     # 服务监听端口
ENV_LOG_LEVEL = "LOG_LEVEL"                   # 日志级别
ENV_OFFLINE_MODE = "OFFLINE_MODE"             # 离线模式（不从HuggingFace下载）
ENV_TRACK_A_GEOMETRY_ONLY = "TRACK_A_GEOMETRY_ONLY"  # 轨道A：仅输出几何白模，不烘焙纹理

# 3D 生成推理参数（珠宝平滑曲面优化，可通过环境变量覆盖）
ENV_GEN_INFERENCE_STEPS = "GEN_INFERENCE_STEPS"
ENV_GEN_GUIDANCE_SCALE = "GEN_GUIDANCE_SCALE"
ENV_GEN_OCTREE_RESOLUTION = "GEN_OCTREE_RESOLUTION"
ENV_GEN_NUM_CHUNKS = "GEN_NUM_CHUNKS"
ENV_GEN_MC_LEVEL = "GEN_MC_LEVEL"
ENV_GEN_MC_ALGO = "GEN_MC_ALGO"
ENV_GEN_JEWELRY_SMOOTH_ITER = "GEN_JEWELRY_SMOOTH_ITER"


@dataclass
class GenerationConfig:
    """
    Hunyuan3D 推理与珠宝网格后处理默认参数。
    面向珠宝 CAD：强调对称、平整大面与顺滑过渡，抑制 AI 网格凹凸噪点。
    """
    num_inference_steps: int = 50
    guidance_scale: float = 4.5
    octree_resolution: int = 384
    num_chunks: int = 12000
    mc_level: float = 0.0
    mc_algo: Optional[str] = "dmc"
    box_v: float = 1.01
    jewelry_taubin_iterations: int = 10
    jewelry_taubin_lambda: float = 0.5
    jewelry_taubin_nu: float = -0.53
    jewelry_spike_aspect_ratio: float = 40.0
    jewelry_min_face_area_ratio: float = 0.0015


@dataclass
class ModelConfig:
    """模型配置"""
    version: str = "mini"              # 模型版本: mini / standard / turbo
    model_path: str = "./models/"      # 模型本地存放路径
    offline_mode: bool = True          # 是否离线模式
    batch_size: int = 1                # 批处理大小
    image_resolution: int = 256        # 输入图像分辨率
    point_cloud_density: int = 2048    # 点云密度
    use_fp16: bool = True              # 是否使用半精度推理
    cuda_device: str = "0"             # CUDA设备编号

    # Hunyuan3D-2 模型相关配置
    hunyuan_model_name: str = "tencent/Hunyuan3D-2"
    hunyuan_image_to_3d_model: str = "tencent/Hunyuan3D-2-Image-to-3D"
    hunyuan_text_to_3d_model: str = "tencent/Hunyuan3D-2-Text-to-3D"


@dataclass
class ServiceConfig:
    """服务配置"""
    host: str = "0.0.0.0"             # 监听地址
    port: int = 8855                   # 监听端口（Docker内部端口）
    log_level: str = "info"            # 日志级别
    cors_origins: list = field(default_factory=lambda: ["*"])  # CORS允许的来源
    output_dir: str = "./outputs/"     # 输出文件目录
    inlay_db_path: str = "./镶嵌结构数据库/"  # 镶嵌结构数据库路径
    max_upload_size: int = 50 * 1024 * 1024  # 最大上传文件大小（50MB）
    task_timeout: int = 600            # 任务超时时间（秒）
    max_concurrent_tasks: int = 3      # 最大并发任务数
    track_a_geometry_only: bool = True  # 轨道A默认纯几何（不调用 Paint 纹理）


@dataclass
class AppConfig:
    """应用总配置"""
    model: ModelConfig = field(default_factory=ModelConfig)
    generation: GenerationConfig = field(default_factory=GenerationConfig)
    service: ServiceConfig = field(default_factory=ServiceConfig)
    gpu_info: Optional[GPUInfo] = None
    recommendation: Optional[ModelRecommendation] = None


def _resolve_model_path(raw_path: str) -> str:
    """
    将 MODEL_PATH 解析为绝对路径；无效时回退到项目根目录下的 models/。
    """
    candidate = Path(raw_path).expanduser()
    if not candidate.is_absolute():
        candidate = (Path.cwd() / candidate).resolve()

    if candidate.is_dir():
        return str(candidate)

    project_models = Path(__file__).resolve().parent.parent.parent / "models"
    if project_models.is_dir():
        logger.warning(
            "MODEL_PATH 无效 (%s)，回退至项目 models: %s",
            raw_path,
            project_models,
        )
        return str(project_models.resolve())

    return str(candidate)


def _load_model_config() -> ModelConfig:
    """
    加载模型配置
    优先级: 环境变量 > GPU自动检测 > 默认值
    """
    config = ModelConfig()

    # 1. 模型路径（环境变量优先，解析为绝对路径）
    raw_model_path = os.environ.get(ENV_MODEL_PATH, config.model_path)
    config.model_path = _resolve_model_path(raw_model_path)
    logger.info(f"模型路径: {config.model_path}")

    # 2. 离线模式
    offline_env = os.environ.get(ENV_OFFLINE_MODE, "true").lower()
    config.offline_mode = offline_env in ("true", "1", "yes")
    logger.info(f"离线模式: {'开启' if config.offline_mode else '关闭'}")

    # 3. CUDA设备
    config.cuda_device = os.environ.get(ENV_CUDA_DEVICE, config.cuda_device)
    os.environ["CUDA_VISIBLE_DEVICES"] = config.cuda_device
    logger.info(f"CUDA设备: {config.cuda_device}")

    # 4. 检测GPU硬件
    gpu_info = detect_gpu()
    recommendation = get_recommended_model(gpu_info)

    # 5. 模型版本（环境变量优先，否则根据GPU自动选择）
    forced_version = os.environ.get(ENV_MODEL_VERSION, "").lower().strip()
    if forced_version in ("mini", "standard", "turbo", "mv"):
        config.version = forced_version
        logger.info(f"通过环境变量强制指定模型版本: {config.version}")
    else:
        config.version = recommendation.model_version
        logger.info(f"根据GPU自动选择模型版本: {config.version} ({recommendation.reason})")

    # 6. 根据模型版本设置参数
    _apply_version_params(config, recommendation)

    # 7. 根据显存决定是否使用FP16
    if gpu_info.is_available and gpu_info.vram_gb >= 8:
        config.use_fp16 = True
    else:
        config.use_fp16 = False

    return config


def _apply_version_params(config: ModelConfig, recommendation: ModelRecommendation):
    """
    根据模型版本应用对应的参数配置
    """
    config.batch_size = recommendation.batch_size
    config.image_resolution = recommendation.image_resolution
    config.point_cloud_density = recommendation.point_cloud_density

    # 各版本的模型子路径
    version_sub_paths = {
        "mini": "hunyuan3d-2-mini",
        "standard": "hunyuan3d-2-standard",
        "turbo": "hunyuan3d-2-turbo",
    }
    # 模型本地路径会拼接版本子目录
    # 实际使用时: model_path / version_sub_paths[version]


def _load_generation_config() -> GenerationConfig:
    """加载 3D 生成推理默认参数（珠宝平滑优化）"""
    cfg = GenerationConfig()

    steps = os.environ.get(ENV_GEN_INFERENCE_STEPS, "").strip()
    if steps.isdigit():
        cfg.num_inference_steps = max(5, min(100, int(steps)))

    guidance = os.environ.get(ENV_GEN_GUIDANCE_SCALE, "").strip()
    if guidance:
        try:
            cfg.guidance_scale = max(0.0, min(15.0, float(guidance)))
        except ValueError:
            pass

    octree = os.environ.get(ENV_GEN_OCTREE_RESOLUTION, "").strip()
    if octree.isdigit():
        cfg.octree_resolution = max(256, min(512, int(octree)))

    chunks = os.environ.get(ENV_GEN_NUM_CHUNKS, "").strip()
    if chunks.isdigit():
        cfg.num_chunks = max(2000, min(50000, int(chunks)))

    mc_level = os.environ.get(ENV_GEN_MC_LEVEL, "").strip()
    if mc_level:
        try:
            cfg.mc_level = float(mc_level)
        except ValueError:
            pass

    mc_algo = os.environ.get(ENV_GEN_MC_ALGO, "").strip().lower()
    if mc_algo in ("", "default", "none"):
        cfg.mc_algo = None
    elif mc_algo in ("mc", "dmc", "flashvdm_mc", "flashvdm"):
        cfg.mc_algo = mc_algo

    smooth_iter = os.environ.get(ENV_GEN_JEWELRY_SMOOTH_ITER, "").strip()
    if smooth_iter.isdigit():
        cfg.jewelry_taubin_iterations = max(0, min(30, int(smooth_iter)))

    logger.info(
        "生成参数(珠宝默认): steps=%d guidance=%.2f octree=%d chunks=%d "
        "mc_algo=%s taubin_iter=%d",
        cfg.num_inference_steps,
        cfg.guidance_scale,
        cfg.octree_resolution,
        cfg.num_chunks,
        cfg.mc_algo or "default",
        cfg.jewelry_taubin_iterations,
    )
    return cfg


def _load_service_config() -> ServiceConfig:
    """
    加载服务配置
    """
    config = ServiceConfig()

    # 监听地址和端口
    config.host = os.environ.get(ENV_HOST, config.host)
    config.port = int(os.environ.get(ENV_PORT, config.port))

    # 日志级别
    config.log_level = os.environ.get(ENV_LOG_LEVEL, config.log_level).lower()

    # 输出目录
    config.output_dir = os.environ.get(ENV_OUTPUT_DIR, config.output_dir)

    # 镶嵌结构数据库路径
    config.inlay_db_path = os.environ.get(ENV_INLAY_DB_PATH, config.inlay_db_path)

    geo_env = os.environ.get(ENV_TRACK_A_GEOMETRY_ONLY, "true").lower()
    config.track_a_geometry_only = geo_env in ("true", "1", "yes")

    logger.info(
        f"服务配置: 地址={config.host}:{config.port}, "
        f"日志级别={config.log_level}, "
        f"输出目录={config.output_dir}, "
        f"镶嵌数据库={config.inlay_db_path}, "
        f"轨道A纯几何={config.track_a_geometry_only}"
    )

    return config


def load_config() -> AppConfig:
    """
    加载完整的应用配置
    这是配置加载的入口函数
    """
    logger.info("=" * 60)
    logger.info("开始加载应用配置...")
    logger.info("=" * 60)

    app_config = AppConfig()

    # 加载模型配置（包含GPU检测）
    app_config.model = _load_model_config()

    # 3D 生成推理默认参数
    app_config.generation = _load_generation_config()

    # 加载服务配置
    app_config.service = _load_service_config()

    # 保存GPU信息
    app_config.gpu_info = detect_gpu()
    app_config.recommendation = get_recommended_model(app_config.gpu_info)

    # 确保输出目录存在
    os.makedirs(app_config.service.output_dir, exist_ok=True)

    logger.info("=" * 60)
    logger.info("应用配置加载完成")
    logger.info(f"  GPU: {app_config.gpu_info.gpu_name} ({app_config.gpu_info.vram_gb}GB)")
    logger.info(f"  模型版本: {app_config.model.version}")
    logger.info(f"  服务端口: {app_config.service.port}")
    logger.info("=" * 60)

    return app_config


# 全局配置实例（延迟加载）
_global_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    """
    获取全局配置实例（单例模式）
    首次调用时加载配置，后续调用返回缓存
    """
    global _global_config
    if _global_config is None:
        _global_config = load_config()
    return _global_config


def reload_config() -> AppConfig:
    """
    重新加载配置（用于运行时更新）
    """
    global _global_config
    _global_config = load_config()
    return _global_config
