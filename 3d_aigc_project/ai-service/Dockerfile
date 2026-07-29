# ============================================================
# 3D AIGC 推理服务 Dockerfile（多阶段构建）
# 默认构建 CUDA PyTorch（compose 传入 TORCH_INDEX=cu121）
# 紧急 CPU：docker-compose.cpu.yml 覆盖为 cpu 索引
# ============================================================

FROM python:3.10-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_REQUIRE_HASHES=0 \
    PIP_DEFAULT_TIMEOUT=1000 \
    TZ=Asia/Shanghai

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    wget \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app

# CUDA torch 走官方 cu121；其余 PyPI 走清华镜像（Docker 内 npmmirror DNS 不可用）
ARG TORCH_INDEX=https://download.pytorch.org/whl/cu121
ARG PIP_MIRROR=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

COPY requirements.txt .

# torch 的小型 PyPI 依赖先走镜像（避免 cu121 索引回退到 files.pythonhosted.org ~12kB/s）
RUN pip install --no-cache-dir \
    -i ${PIP_MIRROR} \
    --trusted-host ${PIP_TRUSTED_HOST} \
    sympy networkx filelock fsspec jinja2 typing-extensions pillow numpy mpmath

# 独立层：CUDA torch + NVIDIA 包仅从官方 cu121 索引（勿加 extra-index，否则会拉到错误版本）
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url ${TORCH_INDEX} \
    --trusted-host download.pytorch.org

# 其余依赖仅走 PyPI 镜像，避免与 torch 索引混用导致 hash/metadata 冲突
RUN pip install --no-cache-dir \
    -r requirements.txt \
    -i ${PIP_MIRROR} \
    --trusted-host ${PIP_TRUSTED_HOST}

FROM dependencies AS app

WORKDIR /app

COPY app/ ./app/

RUN mkdir -p /app/models /app/outputs /app/uploads /app/inlay_cache

ENV MODEL_PATH=/app/models \
    OUTPUT_DIR=/app/outputs \
    INLAY_DB_PATH=/app/inlay_db \
    OFFLINE_MODE=true \
    LOG_LEVEL=info \
    SERVICE_HOST=0.0.0.0 \
    SERVICE_PORT=8855 \
    REQUIRE_GPU=1

EXPOSE 8855

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:8855/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8855", "--workers", "1"]
