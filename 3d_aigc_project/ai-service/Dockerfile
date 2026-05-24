# ============================================================
# 3D AIGC 推理服务 Dockerfile
# 基于 python:3.10-slim，安装CUDA依赖，暴露8855端口
# ============================================================

# ---- 阶段1: 基础镜像 ----
FROM python:3.10-slim AS base

# 设置环境变量
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Shanghai

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- 阶段2: CUDA支持（可选，根据实际GPU型号调整） ----
# 如果需要CUDA支持，取消下面的注释并选择合适的CUDA版本
# 注意: 需要NVIDIA Container Toolkit支持

# 方案A: 使用NVIDIA官方CUDA镜像（推荐）
# FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS cuda-base
# FROM python:3.10-slim AS base

# 方案B: 在slim镜像上安装CUDA toolkit（体积更小）
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     nvidia-cuda-toolkit \
#     && rm -rf /var/lib/apt/lists/*

# ---- 阶段3: Python依赖安装 ----
FROM base AS dependencies

WORKDIR /app

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
# 先安装PyTorch（从官方源，确保CUDA支持）
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 安装其他依赖
RUN pip install --no-cache-dir -r requirements.txt

# ---- 阶段4: 应用代码 ----
FROM dependencies AS app

WORKDIR /app

# 复制应用代码
COPY app/ ./app/

# 创建必要的目录
RUN mkdir -p models outputs

# 复制模型文件（如果需要离线部署）
# COPY models/ ./models/

# 设置环境变量
ENV MODEL_PATH=./models/ \
    OUTPUT_DIR=./outputs/ \
    INLAY_DB_PATH=../../镶嵌结构数据库/ \
    OFFLINE_MODE=true \
    LOG_LEVEL=info \
    SERVICE_HOST=0.0.0.0 \
    SERVICE_PORT=8855 \
    CUDA_VISIBLE_DEVICES=0

# 暴露端口
EXPOSE 8855

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8855/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8855", "--workers", "1"]
