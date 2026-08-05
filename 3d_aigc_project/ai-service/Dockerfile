# ============================================================
# 3D AIGC 推理服务 Dockerfile（多阶段构建）
# 默认构建 CUDA PyTorch（compose 传入 TORCH_INDEX=cu121）
# 紧急 CPU：docker-compose.cpu.yml 覆盖为 cpu 索引
# ============================================================

# diso 编译：NVIDIA devel 镜像含 nvcc（debian12 apt 已无 cuda-nvcc-12-1）
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04 AS diso-builder

ARG TORCH_INDEX=https://download.pytorch.org/whl/cu121
ARG PIP_MIRROR=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
ARG DISO_VERSION=0.1.4
ARG TORCH_CUDA_ARCH_LIST=8.9

ENV DEBIAN_FRONTEND=noninteractive \
    FORCE_CUDA=1 \
    TORCH_CUDA_ARCH_LIST=${TORCH_CUDA_ARCH_LIST} \
    MAX_JOBS=4 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev ninja-build \
    && rm -rf /var/lib/apt/lists/*

RUN i=0; \
    until pip3 install --no-cache-dir torch --index-url ${TORCH_INDEX} \
        --trusted-host download.pytorch.org \
        && pip3 install --no-cache-dir wheel \
            -i ${PIP_MIRROR} --trusted-host ${PIP_TRUSTED_HOST} \
        && pip3 install --no-cache-dir "diso==${DISO_VERSION}" --no-build-isolation \
            -i ${PIP_MIRROR} --trusted-host ${PIP_TRUSTED_HOST} \
        && python3 -c "from diso import DiffDMC; print('diso builder OK')"; do \
        i=$((i + 1)); \
        if [ "$i" -ge 3 ]; then exit 1; fi; \
        echo "WARN: diso-builder pip failed (attempt $i), retrying..."; \
        sleep 15; \
    done

RUN SITE=$(python3 -c "import site; print(site.getsitepackages()[0])") \
    && mkdir -p /diso-export \
    && cp -r "${SITE}/diso" /diso-export/ \
    && cp -r "${SITE}"/diso-*.dist-info /diso-export/

# bookworm：NVIDIA cuda apt 与 trixie OpenPGP 策略不兼容
FROM python:3.10-slim-bookworm AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_REQUIRE_HASHES=0 \
    PIP_DEFAULT_TIMEOUT=1000 \
    TZ=Asia/Shanghai

# 国内/不稳定网络：Debian 镜像 + apt 重试；libspatialindex-dev 单独重试（rtree 依赖）
RUN set -eux; \
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
      if [ -f "$f" ]; then \
        sed -i \
          -e 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' \
          -e 's|https://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' \
          -e 's|http://security.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' \
          -e 's|https://security.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' \
          "$f"; \
      fi; \
    done; \
    printf '%s\n' \
      'Acquire::Retries "5";' \
      'Acquire::http::Timeout "120";' \
      'Acquire::https::Timeout "120";' \
      > /etc/apt/apt.conf.d/80-retries; \
    apt-get update; \
    apt-get install -y --no-install-recommends --fix-missing \
      build-essential \
      cmake \
      git \
      curl \
      wget \
      libgl1 \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender-dev; \
    i=0; \
    until apt-get update && apt-get install -y --no-install-recommends --fix-missing libspatialindex-dev; do \
      i=$((i + 1)); \
      if [ "$i" -ge 5 ]; then exit 1; fi; \
      sleep $((i * 10)); \
    done; \
    rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

WORKDIR /app

# CUDA torch 走官方 cu121；其余 PyPI 走清华镜像（Docker 内 npmmirror DNS 不可用）
ARG TORCH_INDEX=https://download.pytorch.org/whl/cu121
ARG PIP_MIRROR=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
ARG ENABLE_CAD_REVERSE=1
ARG ENABLE_DMC=1
ARG DISO_VERSION=0.1.4
ARG TORCH_CUDA_ARCH_LIST=8.9

COPY requirements.txt .

# torch 的小型 PyPI 依赖先走镜像（避免 cu121 索引回退到 files.pythonhosted.org ~12kB/s）
RUN pip install --no-cache-dir \
    -i ${PIP_MIRROR} \
    --trusted-host ${PIP_TRUSTED_HOST} \
    sympy networkx filelock fsspec jinja2 typing-extensions pillow numpy mpmath

# 独立层：CUDA torch + NVIDIA 包仅从官方 cu121 索引（慢网易 corrupt，失败重试）
RUN i=0; \
    until pip install --no-cache-dir \
        torch torchvision \
        --index-url ${TORCH_INDEX} \
        --trusted-host download.pytorch.org; do \
        i=$((i + 1)); \
        if [ "$i" -ge 3 ]; then exit 1; fi; \
        echo "WARN: torch install failed (attempt $i), retrying..."; \
        sleep 15; \
    done

# 其余依赖仅走 PyPI 镜像，避免与 torch 索引混用导致 hash/metadata 冲突
RUN pip install --no-cache-dir \
    -r requirements.txt \
    -i ${PIP_MIRROR} \
    --trusted-host ${PIP_TRUSTED_HOST} \
    || ( \
        echo "Full requirements install failed; retrying without pythonocc-core" && \
        grep -v '^pythonocc-core' requirements.txt > /tmp/requirements-no-occ.txt && \
        pip install --no-cache-dir \
            -r /tmp/requirements-no-occ.txt \
            -i ${PIP_MIRROR} \
            --trusted-host ${PIP_TRUSTED_HOST} \
    )

# Ultra/Quality mc_algo=dmc：从 diso-builder 复制已编译包（PyPI 仅 sdist）
COPY --from=diso-builder /diso-export/ /usr/local/lib/python3.10/site-packages/
RUN if [ "${ENABLE_DMC}" = "1" ]; then \
        python -c "from diso import DiffDMC; print('diso OK')"; \
    fi

# Ultra CAD：单独尝试安装 pythonocc-core（失败时不阻断镜像构建）
RUN if [ "${ENABLE_CAD_REVERSE}" = "1" ]; then \
        pip install --no-cache-dir "pythonocc-core>=7.7.0,<7.9.0" \
            -i ${PIP_MIRROR} \
            --trusted-host ${PIP_TRUSTED_HOST} \
        || echo "WARN: pythonocc-core install failed; Ultra STEP export disabled"; \
    fi

FROM dependencies AS app

WORKDIR /app

COPY app/ ./app/
COPY scripts/ ./scripts/

RUN mkdir -p /app/models /app/outputs /app/uploads /app/inlay_cache

ENV MODEL_PATH=/app/models \
    OUTPUT_DIR=/app/outputs \
    INLAY_DB_PATH=/app/inlay_db \
    OFFLINE_MODE=true \
    LOG_LEVEL=info \
    ENABLE_CAD_REVERSE=1 \
    ULTRA_CAD_ENABLED=1 \
    SERVICE_HOST=0.0.0.0 \
    SERVICE_PORT=8855 \
    REQUIRE_GPU=1

EXPOSE 8855

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:8855/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8855", "--workers", "1"]
