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
ENV_REQUIRE_GPU = "REQUIRE_GPU"               # 强制 GPU；默认 true，禁止静默 CPU
ENV_HOST = "SERVICE_HOST"                     # 服务监听地址
ENV_PORT = "SERVICE_PORT"                     # 服务监听端口
ENV_LOG_LEVEL = "LOG_LEVEL"                   # 日志级别
ENV_OFFLINE_MODE = "OFFLINE_MODE"             # 离线模式（不从HuggingFace下载）
ENV_TRACK_A_GEOMETRY_ONLY = "TRACK_A_GEOMETRY_ONLY"  # 轨道A：仅输出几何白模，不烘焙纹理
ENV_MAX_CONCURRENT_TASKS = "MAX_CONCURRENT_TASKS"   # 可同时处理的任务数（含排队+后处理）
ENV_MAX_CONCURRENT_GPU_JOBS = "MAX_CONCURRENT_GPU_JOBS"  # GPU 推理并发（实际强制≤1）
ENV_MAX_POSTPROCESS_WORKERS = "MAX_POSTPROCESS_WORKERS"  # 后处理线程池大小
ENV_ENABLE_GEM_REPAINT = "ENABLE_GEM_REPAINT"
ENV_GEM_REPAINT_MODEL_PATH = "GEM_REPAINT_MODEL_PATH"
ENV_GEM_REPAINT_STRENGTH = "GEM_REPAINT_STRENGTH"
ENV_GEM_REPAINT_MASK_DILATE = "GEM_REPAINT_MASK_DILATE"
ENV_GEM_REPAINT_SEED = "GEM_REPAINT_SEED"
ENV_ALIGNMENT_MODE = "ALIGNMENT_MODE"  # casa | ring_frame
ENV_CASA_SOFT_ACCEPT = "CASA_SOFT_ACCEPT"
ENV_CASA_MIN_PEAK_RATIO = "CASA_MIN_PEAK_RATIO"
ENV_CASA_MIN_INLAY_OVERLAP_RATIO = "CASA_MIN_INLAY_OVERLAP_RATIO"
ENV_USE_OMNI_CONDITIONING = "USE_OMNI_CONDITIONING"
ENV_OMNI_MODEL_PATH = "OMNI_MODEL_PATH"


def is_require_gpu() -> bool:
    """
    是否强制要求 CUDA。
    默认 True（未设置环境变量时也要求 GPU）；仅 REQUIRE_GPU=0/false/no 时允许 CPU。
    """
    raw = os.environ.get(ENV_REQUIRE_GPU, "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def assert_cuda_available(context: str = "startup") -> None:
    """
    REQUIRE_GPU 开启时若 CUDA 不可用则立即以非零退出，禁止静默落到 CPU。
    """
    if not is_require_gpu():
        return
    try:
        import torch
        cuda_ok = bool(torch.cuda.is_available())
    except Exception as e:
        logger.error(
            "[REQUIRE_GPU] %s: 无法检测 CUDA（torch 导入失败）: %s",
            context,
            e,
        )
        raise SystemExit(1) from e

    if not cuda_ok:
        logger.error(
            "[REQUIRE_GPU] %s: CUDA 不可用，拒绝以 CPU 运行。"
            "请确认 Docker 已分配 GPU（docker-compose.yml 内置 devices），"
            "或紧急场景使用 start.bat --cpu（REQUIRE_GPU=0）。",
            context,
        )
        raise SystemExit(1)

    try:
        import torch
        name = torch.cuda.get_device_name(0)
        logger.info("[REQUIRE_GPU] CUDA 可用: %s", name)
    except Exception:
        logger.info("[REQUIRE_GPU] CUDA 可用")

# 3D 生成推理参数（珠宝平滑曲面优化，可通过环境变量覆盖）
ENV_GEN_INFERENCE_STEPS = "GEN_INFERENCE_STEPS"
ENV_GEN_GUIDANCE_SCALE = "GEN_GUIDANCE_SCALE"
ENV_GEN_OCTREE_RESOLUTION = "GEN_OCTREE_RESOLUTION"
ENV_GEN_NUM_CHUNKS = "GEN_NUM_CHUNKS"
ENV_GEN_MC_LEVEL = "GEN_MC_LEVEL"
ENV_GEN_MC_ALGO = "GEN_MC_ALGO"
ENV_GEN_JEWELRY_SMOOTH_ITER = "GEN_JEWELRY_SMOOTH_ITER"
ENV_GEN_JEWELRY_TARGET_FACES = "GEN_JEWELRY_TARGET_FACES"
ENV_GEN_JEWELRY_COARSE_FACES = "GEN_JEWELRY_COARSE_FACES"
ENV_GEN_JEWELRY_SUBDIVIDE_LOOP = "GEN_JEWELRY_SUBDIVIDE_LOOP"
ENV_GEN_ULTRA_OCTREE_RESOLUTION = "GEN_ULTRA_OCTREE_RESOLUTION"
ENV_GEN_ULTRA_INFERENCE_STEPS = "GEN_ULTRA_INFERENCE_STEPS"
ENV_ULTRA_CAD_ENABLED = "ULTRA_CAD_ENABLED"
ENV_ULTRA_FIT_TOLERANCE_MM = "ULTRA_FIT_TOLERANCE_MM"
ENV_ULTRA_MAX_SURFACES = "ULTRA_MAX_SURFACES"
ENV_ULTRA_SHARP_ANGLE_DEG = "ULTRA_SHARP_ANGLE_DEG"
ENV_ULTRA_PLANAR_MERGE_ANGLE_DEG = "ULTRA_PLANAR_MERGE_ANGLE_DEG"
ENV_ULTRA_STEP_SCHEMA = "ULTRA_STEP_SCHEMA"
ENV_ENABLE_CAD_REVERSE = "ENABLE_CAD_REVERSE"
ENV_ULTRA_MODE_ENABLED = "ULTRA_MODE_ENABLED"

ULTRA_MODE_DISABLED_MESSAGE = "Ultra CAD 功能全面升级中，敬请期待"


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
    jewelry_taubin_iterations: int = 18
    jewelry_taubin_lambda: float = 0.5
    jewelry_taubin_nu: float = -0.53
    jewelry_spike_aspect_ratio: float = 35.0
    jewelry_min_face_area_ratio: float = 0.004
    # 减面 + 曲面重建：先 QEM 粗化，再 Loop 细分恢复顺滑，最后 Taubin
    jewelry_coarse_faces: int = 16000
    jewelry_subdivide_loop_iterations: int = 1
    jewelry_target_faces: int = 48000
    jewelry_decimate_min_input_faces: int = 30000
    jewelry_post_decimate_taubin_iterations: int = 12


def dmc_surface_extractor_available() -> bool:
    """DiffDMC (mc_algo=dmc) 依赖 diso；缺失或编译失败时不可用。"""
    try:
        from diso import DiffDMC  # noqa: F401

        return True
    except ImportError:
        return False


def is_ultra_mode_enabled() -> bool:
    """Ultra CAD 模式是否开放（默认封禁）。"""
    raw = os.environ.get(ENV_ULTRA_MODE_ENABLED, "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


class UltraModeDisabledError(ValueError):
    """Ultra 模式封禁时抛出。"""

    def __init__(self) -> None:
        super().__init__(ULTRA_MODE_DISABLED_MESSAGE)


def resolve_mc_algo(mc_algo: Optional[str]) -> Optional[str]:
    """
    解析 mc_algo：dmc 需要 diso，不可用时回退默认 marching cubes（不传 mc_algo）。
    """
    if not mc_algo or mc_algo in ("mc", "default"):
        return None
    if mc_algo == "dmc" and not dmc_surface_extractor_available():
        logger.warning(
            "mc_algo=dmc 不可用（缺少 diso 或编译失败），回退默认 marching cubes"
        )
        return None
    return mc_algo


@dataclass
class UltraCadConfig:
    """Ultra 模式 mesh → NURBS/STEP 逆向参数。"""
    enabled: bool = True
    sharp_angle_deg: float = 30.0
    planar_merge_angle_deg: float = 3.0
    fit_tolerance_mm: float = 0.08
    max_surfaces: int = 60
    step_schema: str = "AP214"
    fallback_on_failure: bool = True
    min_patch_faces: int = 12
    max_patch_faces: int = 8000


@dataclass
class GenerationModeSettings:
    """单次生成任务的模式配置（推理参数 + 后处理开关）。"""
    config: GenerationConfig
    apply_jewelry_prompt: bool = True
    apply_jewelry_mesh_finish: bool = True
    apply_jewelry_repair_smooth: bool = True
    apply_cad_reverse: bool = False
    ultra_cad: Optional[UltraCadConfig] = None


def _fast_generation_config() -> GenerationConfig:
    """
    急速模式：恢复旧版 pipeline 默认行为。
    较低 octree/steps、无 dmc、无珠宝 prompt 与曲面后处理。
    """
    return GenerationConfig(
        num_inference_steps=30,
        guidance_scale=7.5,
        octree_resolution=256,
        num_chunks=8000,
        mc_level=0.0,
        mc_algo=None,
        box_v=1.01,
        jewelry_taubin_iterations=0,
        jewelry_taubin_lambda=0.5,
        jewelry_taubin_nu=-0.53,
        jewelry_spike_aspect_ratio=80.0,
        jewelry_min_face_area_ratio=0.0005,
        jewelry_coarse_faces=0,
        jewelry_subdivide_loop_iterations=0,
        jewelry_target_faces=0,
        jewelry_decimate_min_input_faces=0,
        jewelry_post_decimate_taubin_iterations=0,
    )


def _quality_generation_config() -> GenerationConfig:
    """
    高质量模式：最高外观顺滑与建模精细度，不限制面数（跳过 QEM 减面）。
    """
    return GenerationConfig(
        num_inference_steps=65,
        guidance_scale=4.5,
        octree_resolution=512,
        num_chunks=16000,
        mc_level=0.0,
        mc_algo="dmc",
        box_v=1.01,
        jewelry_taubin_iterations=24,
        jewelry_taubin_lambda=0.5,
        jewelry_taubin_nu=-0.53,
        jewelry_spike_aspect_ratio=30.0,
        jewelry_min_face_area_ratio=0.003,
        jewelry_coarse_faces=0,
        jewelry_subdivide_loop_iterations=2,
        jewelry_target_faces=0,
        jewelry_decimate_min_input_faces=0,
        jewelry_post_decimate_taubin_iterations=16,
    )


def _custom_generation_config(
    target_faces: int = 48000,
    octree_resolution: Optional[int] = None,
    inference_steps: Optional[int] = None,
) -> GenerationConfig:
    """自定义模式：继承 quality 基线，允许用户指定目标面数与可选推理参数。"""
    cfg = _quality_generation_config()
    cfg.jewelry_target_faces = max(0, min(200_000, int(target_faces)))
    if octree_resolution is not None:
        cfg.octree_resolution = max(256, min(512, int(octree_resolution)))
    if inference_steps is not None:
        cfg.num_inference_steps = max(5, min(100, int(inference_steps)))
    if cfg.jewelry_target_faces > 0:
        cfg.jewelry_coarse_faces = max(cfg.jewelry_target_faces // 3, 8000)
        cfg.jewelry_decimate_min_input_faces = max(cfg.jewelry_target_faces, 30000)
    return cfg


def _ultra_generation_config() -> GenerationConfig:
    """
    Ultra 模式：最高推理精度，保留全细节 mesh 供 CAD 逆向；跳过 QEM/Loop 减面。
    """
    return GenerationConfig(
        num_inference_steps=65,
        guidance_scale=4.5,
        octree_resolution=512,
        num_chunks=16000,
        mc_level=0.0,
        mc_algo="dmc",
        box_v=1.01,
        jewelry_taubin_iterations=6,
        jewelry_taubin_lambda=0.5,
        jewelry_taubin_nu=-0.53,
        jewelry_spike_aspect_ratio=35.0,
        jewelry_min_face_area_ratio=0.003,
        jewelry_coarse_faces=0,
        jewelry_subdivide_loop_iterations=0,
        jewelry_target_faces=0,
        jewelry_decimate_min_input_faces=0,
        jewelry_post_decimate_taubin_iterations=0,
    )


def _load_ultra_cad_config() -> UltraCadConfig:
    cfg = UltraCadConfig()
    raw = os.environ.get(ENV_ULTRA_CAD_ENABLED, "1").strip().lower()
    cfg.enabled = raw not in ("0", "false", "no", "off")
    tol = os.environ.get(ENV_ULTRA_FIT_TOLERANCE_MM, "").strip()
    if tol:
        try:
            cfg.fit_tolerance_mm = max(0.01, min(1.0, float(tol)))
        except ValueError:
            pass
    max_surf = os.environ.get(ENV_ULTRA_MAX_SURFACES, "").strip()
    if max_surf.isdigit():
        cfg.max_surfaces = max(4, min(200, int(max_surf)))
    sharp = os.environ.get(ENV_ULTRA_SHARP_ANGLE_DEG, "").strip()
    if sharp:
        try:
            cfg.sharp_angle_deg = max(5.0, min(60.0, float(sharp)))
        except ValueError:
            pass
    planar = os.environ.get(ENV_ULTRA_PLANAR_MERGE_ANGLE_DEG, "").strip()
    if planar:
        try:
            cfg.planar_merge_angle_deg = max(0.5, min(15.0, float(planar)))
        except ValueError:
            pass
    schema = os.environ.get(ENV_ULTRA_STEP_SCHEMA, "").strip().upper()
    if schema in ("AP214", "AP242"):
        cfg.step_schema = schema
    return cfg


def resolve_generation_mode(
    mode: Optional[str] = None,
    params: Optional[dict] = None,
) -> GenerationModeSettings:
    """
    解析生成模式。缺省 quality，保持向后兼容（当前高质量默认）。
    支持: fast / quality / custom / ultra（及中文别名）。
    """
    if mode is not None and hasattr(mode, "value"):
        mode = mode.value
    normalized = (str(mode) if mode else "quality").strip().lower()
    p = params or {}

    if normalized in ("fast", "speed", "急速", "快速"):
        return GenerationModeSettings(
            config=_fast_generation_config(),
            apply_jewelry_prompt=False,
            apply_jewelry_mesh_finish=True,
            apply_jewelry_repair_smooth=False,
            apply_cad_reverse=False,
        )

    if normalized in ("custom", "自定义"):
        target = p.get("custom_target_faces", 48000)
        try:
            target_int = int(target) if target is not None else 48000
        except (TypeError, ValueError):
            target_int = 48000
        octree = p.get("custom_octree_resolution")
        steps = p.get("custom_inference_steps")
        octree_int = int(octree) if octree is not None and str(octree).isdigit() else None
        steps_int = int(steps) if steps is not None and str(steps).isdigit() else None
        return GenerationModeSettings(
            config=_custom_generation_config(target_int, octree_int, steps_int),
            apply_jewelry_prompt=True,
            apply_jewelry_mesh_finish=True,
            apply_jewelry_repair_smooth=True,
            apply_cad_reverse=False,
        )

    if normalized in ("ultra", "cad", "step", "超高精度", "ultra_cad"):
        if not is_ultra_mode_enabled():
            raise UltraModeDisabledError()
        ultra_cfg = _ultra_generation_config()
        ultra_steps = os.environ.get(ENV_GEN_ULTRA_INFERENCE_STEPS, "").strip()
        if ultra_steps.isdigit():
            ultra_cfg.num_inference_steps = max(30, min(100, int(ultra_steps)))
        ultra_octree = os.environ.get(ENV_GEN_ULTRA_OCTREE_RESOLUTION, "").strip()
        if ultra_octree.isdigit():
            ultra_cfg.octree_resolution = max(384, min(512, int(ultra_octree)))
        cad_enabled = os.environ.get(ENV_ENABLE_CAD_REVERSE, "1").strip().lower()
        cad_on = cad_enabled not in ("0", "false", "no", "off")
        ultra_cad = _load_ultra_cad_config()
        ultra_cad.enabled = ultra_cad.enabled and cad_on
        return GenerationModeSettings(
            config=ultra_cfg,
            apply_jewelry_prompt=True,
            apply_jewelry_mesh_finish=True,
            apply_jewelry_repair_smooth=True,
            apply_cad_reverse=ultra_cad.enabled,
            ultra_cad=ultra_cad,
        )

    return GenerationModeSettings(
        config=_quality_generation_config(),
        apply_jewelry_prompt=True,
        apply_jewelry_mesh_finish=True,
        apply_jewelry_repair_smooth=True,
        apply_cad_reverse=False,
    )


def resolve_enable_inlay_postprocess(params: dict) -> bool:
    """
    镶嵌比对/替换后处理开关，默认关闭。
    兼容旧字段 enable_mesh_fusion=true。
    """
    if "enable_inlay_postprocess" in params:
        return bool(params.get("enable_inlay_postprocess"))
    if params.get("enable_mesh_fusion") is True:
        logger.warning(
            "enable_mesh_fusion 已弃用，请改用 enable_inlay_postprocess；"
            "本次仍启用镶嵌后处理"
        )
        return True
    return False


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
    max_concurrent_tasks: int = 8      # 最大并行任务数（验证/后处理可并行；GPU 仍串行）
    max_concurrent_gpu_jobs: int = 1   # GPU 推理并发上限（Hunyuan3D 非线程安全，固定为 1）
    max_postprocess_workers: int = 4   # 后处理线程池 worker 数
    track_a_geometry_only: bool = True  # 轨道A默认纯几何（不调用 Paint 纹理）
    require_gpu: bool = True            # 强制 GPU；False 仅紧急 CPU


@dataclass
class AlignmentConfig:
    """镶嵌对齐算法配置（CASA / ring-frame）"""
    alignment_mode: str = "casa"  # casa | ring_frame
    casa_soft_accept: bool = False
    casa_min_peak_ratio: float = 0.15
    casa_min_pose_confidence: float = 0.12
    casa_scale_min: float = 0.05
    casa_scale_max: float = 50.0
    casa_ratio_std_max: float = 0.45
    casa_min_inlay_overlap_ratio: float = 0.80
    casa_overlap_sample_count: int = 6000


@dataclass
class OmniConfig:
    """Hunyuan3D-Omni 点云条件生成配置"""
    enabled: bool = True
    model_path: str = "./models/hunyuan3d-omni"
    repo_id: str = "tencent/Hunyuan3D-Omni"
    lazy_load: bool = True


@dataclass
class GemRepaintConfig:
    """宝石去反光 AI 重绘配置"""
    enabled: bool = True
    model_path: str = "./models/instruct-pix2pix"
    default_strength: float = 0.45
    default_mask_dilate: int = 8
    default_seed: Optional[int] = 42
    default_prompt: str = (
        "make the gemstone matte and diffuse, remove specular highlights, "
        "keep facet structure and color, do not change metal or prongs"
    )


@dataclass
class AppConfig:
    """应用总配置"""
    model: ModelConfig = field(default_factory=ModelConfig)
    generation: GenerationConfig = field(default_factory=GenerationConfig)
    service: ServiceConfig = field(default_factory=ServiceConfig)
    gem_repaint: GemRepaintConfig = field(default_factory=GemRepaintConfig)
    alignment: AlignmentConfig = field(default_factory=AlignmentConfig)
    omni: OmniConfig = field(default_factory=OmniConfig)
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

    target_faces = os.environ.get(ENV_GEN_JEWELRY_TARGET_FACES, "").strip()
    if target_faces.isdigit():
        cfg.jewelry_target_faces = max(0, min(200_000, int(target_faces)))

    coarse_faces = os.environ.get(ENV_GEN_JEWELRY_COARSE_FACES, "").strip()
    if coarse_faces.isdigit():
        cfg.jewelry_coarse_faces = max(0, min(100_000, int(coarse_faces)))

    loop_iter = os.environ.get(ENV_GEN_JEWELRY_SUBDIVIDE_LOOP, "").strip()
    if loop_iter.isdigit():
        cfg.jewelry_subdivide_loop_iterations = max(0, min(3, int(loop_iter)))

    logger.info(
        "生成参数(珠宝默认): steps=%d guidance=%.2f octree=%d chunks=%d "
        "mc_algo=%s taubin_iter=%d coarse_faces=%d loop=%d target_faces=%d",
        cfg.num_inference_steps,
        cfg.guidance_scale,
        cfg.octree_resolution,
        cfg.num_chunks,
        cfg.mc_algo or "default",
        cfg.jewelry_taubin_iterations,
        cfg.jewelry_coarse_faces,
        cfg.jewelry_subdivide_loop_iterations,
        cfg.jewelry_target_faces,
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
    config.require_gpu = is_require_gpu()

    tasks_env = os.environ.get(ENV_MAX_CONCURRENT_TASKS, "").strip()
    if tasks_env.isdigit():
        config.max_concurrent_tasks = max(1, min(32, int(tasks_env)))

    gpu_jobs_env = os.environ.get(ENV_MAX_CONCURRENT_GPU_JOBS, "").strip()
    if gpu_jobs_env.isdigit():
        config.max_concurrent_gpu_jobs = max(1, min(4, int(gpu_jobs_env)))

    pp_env = os.environ.get(ENV_MAX_POSTPROCESS_WORKERS, "").strip()
    if pp_env.isdigit():
        config.max_postprocess_workers = max(1, min(16, int(pp_env)))

    logger.info(
        f"服务配置: 地址={config.host}:{config.port}, "
        f"日志级别={config.log_level}, "
        f"输出目录={config.output_dir}, "
        f"镶嵌数据库={config.inlay_db_path}, "
        f"轨道A纯几何={config.track_a_geometry_only}, "
        f"REQUIRE_GPU={config.require_gpu}, "
        f"max_concurrent_tasks={config.max_concurrent_tasks}, "
        f"max_concurrent_gpu_jobs={config.max_concurrent_gpu_jobs}, "
        f"max_postprocess_workers={config.max_postprocess_workers}"
    )

    return config


def _load_gem_repaint_config() -> GemRepaintConfig:
    cfg = GemRepaintConfig()

    enabled_env = os.environ.get(ENV_ENABLE_GEM_REPAINT, "1").strip().lower()
    cfg.enabled = enabled_env in ("1", "true", "yes", "on")

    raw_path = os.environ.get(ENV_GEM_REPAINT_MODEL_PATH, cfg.model_path)
    candidate = Path(raw_path).expanduser()
    if not candidate.is_absolute():
        candidate = (Path.cwd() / candidate).resolve()
    cfg.model_path = str(candidate)

    strength_env = os.environ.get(ENV_GEM_REPAINT_STRENGTH, "").strip()
    if strength_env:
        try:
            cfg.default_strength = float(max(0.1, min(1.0, float(strength_env))))
        except ValueError:
            pass

    dilate_env = os.environ.get(ENV_GEM_REPAINT_MASK_DILATE, "").strip()
    if dilate_env.isdigit():
        cfg.default_mask_dilate = max(0, min(32, int(dilate_env)))

    seed_env = os.environ.get(ENV_GEM_REPAINT_SEED, "").strip()
    if seed_env.lstrip("-").isdigit():
        cfg.default_seed = int(seed_env)

    logger.info(
        "宝石重绘配置: enabled=%s model_path=%s strength=%.2f dilate=%d seed=%s",
        cfg.enabled,
        cfg.model_path,
        cfg.default_strength,
        cfg.default_mask_dilate,
        cfg.default_seed,
    )
    return cfg


def _load_alignment_config() -> AlignmentConfig:
    cfg = AlignmentConfig()

    mode = os.environ.get(ENV_ALIGNMENT_MODE, cfg.alignment_mode).strip().lower()
    if mode in ("casa", "ring_frame", "ring-frame", "legacy"):
        cfg.alignment_mode = "ring_frame" if mode in ("ring_frame", "ring-frame", "legacy") else "casa"

    soft_env = os.environ.get(ENV_CASA_SOFT_ACCEPT, "false").strip().lower()
    cfg.casa_soft_accept = soft_env in ("1", "true", "yes", "on")

    peak_env = os.environ.get(ENV_CASA_MIN_PEAK_RATIO, "").strip()
    if peak_env:
        try:
            cfg.casa_min_peak_ratio = float(max(0.0, min(1.0, float(peak_env))))
        except ValueError:
            pass

    overlap_env = os.environ.get(ENV_CASA_MIN_INLAY_OVERLAP_RATIO, "").strip()
    if overlap_env:
        try:
            cfg.casa_min_inlay_overlap_ratio = float(
                max(0.5, min(1.0, float(overlap_env)))
            )
        except ValueError:
            pass

    logger.info(
        "对齐配置: mode=%s casa_soft_accept=%s min_peak_ratio=%.2f "
        "min_inlay_overlap=%.2f",
        cfg.alignment_mode,
        cfg.casa_soft_accept,
        cfg.casa_min_peak_ratio,
        cfg.casa_min_inlay_overlap_ratio,
    )
    return cfg


def _load_omni_config() -> OmniConfig:
    """加载 Hunyuan3D-Omni 点云条件生成配置"""
    cfg = OmniConfig()

    enabled_env = os.environ.get(ENV_USE_OMNI_CONDITIONING, "true").strip().lower()
    cfg.enabled = enabled_env not in ("0", "false", "no", "off")

    omni_path = os.environ.get(ENV_OMNI_MODEL_PATH, "").strip()
    if omni_path:
        cfg.model_path = _resolve_model_path(omni_path)
    else:
        default = Path(cfg.model_path)
        if not default.is_absolute():
            cfg.model_path = str((Path.cwd() / default).resolve())

    logger.info(
        "Omni 配置: enabled=%s model_path=%s repo_id=%s lazy_load=%s",
        cfg.enabled,
        cfg.model_path,
        cfg.repo_id,
        cfg.lazy_load,
    )
    return cfg


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

    # 宝石去反光重绘
    app_config.gem_repaint = _load_gem_repaint_config()

    # 镶嵌对齐（CASA / ring-frame）
    app_config.alignment = _load_alignment_config()

    # Hunyuan3D-Omni 点云条件生成
    app_config.omni = _load_omni_config()

    # 保存GPU信息
    app_config.gpu_info = detect_gpu()
    app_config.recommendation = get_recommended_model(app_config.gpu_info)

    # 强制 GPU：配置阶段即失败退出，避免后续静默 CPU
    assert_cuda_available("load_config")

    # 确保输出目录存在
    os.makedirs(app_config.service.output_dir, exist_ok=True)

    logger.info("=" * 60)
    logger.info("应用配置加载完成")
    logger.info(f"  GPU: {app_config.gpu_info.gpu_name} ({app_config.gpu_info.vram_gb}GB)")
    logger.info(f"  REQUIRE_GPU: {app_config.service.require_gpu}")
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
