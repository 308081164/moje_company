"""
FastAPI应用入口
3D AIGC 推理服务，端口8855（Docker内部端口）
"""

import os
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_config
from app.routers.generate import router as generate_router
from app.routers.preprocess import router as preprocess_router
from app.services.model_manager import get_model_manager
from app.services.generator import get_generator_service
from app.models.schemas import HealthResponse

# ============================================================
# 日志配置
# ============================================================


def setup_logging(log_level: str = "info"):
    """
    配置日志系统
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=level,
        format=(
            "[%(asctime)s] %(levelname)-8s "
            "[%(name)s] %(message)s"
        ),
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 降低第三方库的日志级别
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


# ============================================================
# 应用生命周期管理
# ============================================================

# 应用启动时间（用于计算运行时间）
_start_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    处理启动和关闭事件
    """
    global _start_time
    _start_time = time.time()

    # ---- 启动阶段 ----
    logger = logging.getLogger(__name__)
    logger.info("=" * 60)
    logger.info("3D AIGC 推理服务启动中...")
    logger.info("=" * 60)

    # 加载配置
    config = get_config()
    setup_logging(config.service.log_level)
    logger = logging.getLogger(__name__)

    # 确保输出目录存在
    os.makedirs(config.service.output_dir, exist_ok=True)

    # 初始化生成服务
    generator_service = get_generator_service()
    generator_service.initialize()

    # 配置模型管理器
    model_manager = get_model_manager()
    model_manager.configure(config.model)

    # 预加载模型（失败不阻断服务启动）
    logger.info("开始预加载模型...")
    model_loaded = False
    try:
        model_loaded = model_manager.load_model()
    except Exception as e:
        logger.error("模型预加载异常: %s", e, exc_info=True)
    if model_loaded:
        logger.info("模型预加载成功")
        # 模型预热
        model_manager.warmup()
    else:
        logger.warning(
            "模型预加载失败，将在首次请求时尝试加载。"
            "请检查模型路径和GPU状态。"
        )

    # 挂载静态文件服务（用于提供输出文件下载）
    if os.path.isdir(config.service.output_dir):
        app.mount(
            "/outputs",
            StaticFiles(directory=config.service.output_dir),
            name="outputs",
        )

    logger.info("=" * 60)
    logger.info(f"服务启动完成，监听 {config.service.host}:{config.service.port}")
    logger.info(f"API文档: http://{config.service.host}:{config.service.port}/docs")
    logger.info("=" * 60)

    yield  # 应用运行中

    # ---- 关闭阶段 ----
    logger.info("服务正在关闭...")

    # 卸载模型释放显存
    if model_manager.is_loaded():
        model_manager._unload_models()
        logger.info("模型已卸载，GPU显存已释放")

    logger.info("服务已关闭")


# ============================================================
# 创建FastAPI应用
# ============================================================

app = FastAPI(
    title="3D AIGC 推理服务",
    description="""
    基于 Hunyuan3D-2 的3D模型生成推理服务

    ## 功能
    - **图片到3D**: 将设计图片转换为3D模型
    - **条件生成**: 设计图 + 镶嵌底座 → 珠宝3D模型
    - **网格融合**: 底座 + 生成结果 → 完整模型
    - **硬件自适应**: 根据GPU显存自动选择模型版本

    ## 模型版本
    - `mini`: 8GB以下显存，轻量级模型
    - `standard`: 8-16GB显存，标准模型
    - `turbo`: 16GB以上显存，高性能模型
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================
# CORS配置（允许所有来源）
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],              # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],              # 允许所有HTTP方法
    allow_headers=["*"],              # 允许所有请求头
)

# ============================================================
# 注册路由
# ============================================================

app.include_router(generate_router)
app.include_router(preprocess_router)


# ============================================================
# 健康检查接口
# ============================================================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["系统"],
    summary="健康检查",
    description="检查服务运行状态、GPU可用性和模型加载状态",
)
async def health_check():
    """
    健康检查接口
    """
    global _start_time
    model_manager = get_model_manager()
    generator_service = get_generator_service()

    return HealthResponse(
        status="ok",
        version="1.0.0",
        uptime=round(time.time() - _start_time, 2),
        gpu_available=model_manager.get_model_info().get("device") == "cuda",
        model_loaded=model_manager.is_loaded(),
        active_tasks=len([
            t for t in generator_service.list_tasks()
            if t.status.value == "processing"
        ]),
    )


@app.get(
    "/",
    tags=["系统"],
    summary="服务根路径",
    description="返回服务基本信息",
)
async def root():
    """
    服务根路径
    """
    return {
        "service": "3D AIGC 推理服务",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# ============================================================
# 启动入口（直接运行时使用）
# ============================================================

if __name__ == "__main__":
    import uvicorn

    config = get_config()
    setup_logging(config.service.log_level)

    uvicorn.run(
        "app.main:app",
        host=config.service.host,
        port=config.service.port,
        reload=False,
        log_level=config.service.log_level,
        workers=1,  # GPU模型不支持多worker
    )
