#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

MODE="default"
USE_GPU=1
# 主 compose 已内置 GPU；gpu.yml 为冗余兼容叠加
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.gpu.yml)

rebuild_compose_files() {
  COMPOSE_FILES=(-f docker-compose.yml)
  if [[ "$USE_GPU" -eq 1 ]]; then
    COMPOSE_FILES+=(-f docker-compose.gpu.yml)
  else
    COMPOSE_FILES+=(-f docker-compose.cpu.yml)
  fi
  if [[ "$MODE" == "dev" ]]; then
    COMPOSE_FILES+=(-f docker-compose.dev.yml)
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full)
      MODE="full"
      export COMPOSE_PROFILES=full
      export SPRING_PROFILES_ACTIVE=docker,docker-full
      shift
      ;;
    --dev)
      MODE="dev"
      rebuild_compose_files
      shift
      ;;
    --cpu)
      USE_GPU=0
      rebuild_compose_files
      shift
      ;;
    --gpu)
      # 兼容旧参数：GPU 已是默认，显式指定时强制启用
      USE_GPU=1
      rebuild_compose_files
      shift
      ;;
    --help|-h)
      cat <<'EOF'
用法: ./start.sh [选项]

  （无参数）   默认最小集 + 强制 GPU（需 NVIDIA Toolkit）
  --full       启用 PostgreSQL + MinIO + Redis
  --dev        Vite 热更新前端（叠加 docker-compose.dev.yml）
  --cpu        紧急 CPU（叠加 docker-compose.cpu.yml，REQUIRE_GPU=0，极慢）
  --gpu        显式启用 GPU（默认已启用，保留兼容）

示例:
  ./start.sh
  ./start.sh --full
  ./start.sh --cpu
  ./start.sh --dev --cpu

Agents: 重启请用本脚本或 docker compose up（主文件已含 GPU）。
        禁止省略 GPU 配置导致 DeviceRequests=null。
EOF
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$USE_GPU" -eq 1 ]]; then
  ACCEL="GPU"
else
  ACCEL="CPU"
fi

echo "========================================"
echo " 恒鎏珠宝 3D AIGC - Docker 一键启动"
echo " 模式: $MODE  |  加速: $ACCEL"
echo "========================================"

command -v docker >/dev/null 2>&1 || { echo "[错误] 未检测到 Docker"; exit 1; }

if [[ ! -f .env && -f .env.example ]]; then
  echo "[提示] 从 .env.example 复制 .env"
  cp .env.example .env
fi

mkdir -p uploads outputs

if [[ "$USE_GPU" -eq 1 ]]; then
  echo "[提示] 默认强制 GPU（docker-compose.yml 已内置 device reservation + REQUIRE_GPU=1）"
  echo "       需 NVIDIA Container Toolkit。紧急无 GPU 才用: ./start.sh --cpu"
else
  cat <<'EOF'

************************************************************************
* 警告：正在以紧急 CPU 模式启动（REQUIRE_GPU=0）
* CPU 推理极慢：FAST 模式也可能接近 1 小时，严禁用于日常或 Agent 重启
* 仅在无 NVIDIA GPU / Toolkit 不可用时的应急手段
************************************************************************

EOF
fi

echo "[1/3] 校验 compose 配置..."
if ! docker compose "${COMPOSE_FILES[@]}" config >/dev/null; then
  echo "[错误] docker compose config 校验失败"
  if [[ "$USE_GPU" -eq 1 ]]; then
    echo "       GPU 模式需要已安装 NVIDIA Container Toolkit。"
    echo "       紧急无 GPU 时可改用: ./start.sh --cpu"
  fi
  exit 1
fi

echo "[2/3] 构建并启动全部服务..."
if ! docker compose "${COMPOSE_FILES[@]}" up -d --build; then
  if [[ "$USE_GPU" -eq 1 ]]; then
    echo "[错误] GPU 启动失败。请确认 NVIDIA Toolkit / Docker GPU 支持可用，"
    echo "       紧急才改用 CPU: ./start.sh --cpu"
  fi
  exit 1
fi

if [[ "$USE_GPU" -eq 1 ]]; then
  echo "[3/3] 验证 AI 服务 GPU（/health gpu_available）..."
  GPU_OK=0
  for i in $(seq 1 60); do
    body="$(curl -sf --max-time 3 http://localhost:8855/health 2>/dev/null || true)"
    if [[ -n "$body" ]]; then
      if echo "$body" | grep -q '"gpu_available"[[:space:]]*:[[:space:]]*true'; then
        GPU_OK=1
        break
      fi
      if echo "$body" | grep -q '"gpu_available"[[:space:]]*:[[:space:]]*false'; then
        echo "[错误] 健康检查报告 gpu_available=false，服务未使用 GPU"
        echo "       请检查 DeviceRequests / NVIDIA Toolkit，勿在 CPU 上推理"
        echo "       查看日志: docker compose ${COMPOSE_FILES[*]} logs ai-service"
        exit 1
      fi
    fi
    sleep 5
  done
  if [[ "$GPU_OK" -ne 1 ]]; then
    echo "[错误] 等待 AI 健康检查超时，未能确认 gpu_available=true"
    echo "       查看日志: docker compose ${COMPOSE_FILES[*]} logs -f ai-service"
    exit 1
  fi
  echo "       GPU 验证通过: gpu_available=true"
else
  echo "[3/3] 跳过 GPU 验证（紧急 CPU 模式）"
fi

cat <<EOF

========================================
 服务已启动（${ACCEL}）
 前端:     http://localhost:8853
 业务 API: http://localhost:8854
 AI 文档:  http://localhost:8855/docs
 AI 健康:  http://localhost:8855/health
========================================

 首次启动请导入镶嵌库 legacy 数据：
   curl -X POST http://localhost:8854/api/inlay/v2/import/scan-legacy

 查看日志: docker compose ${COMPOSE_FILES[*]} logs -f
 停止服务: ./stop.sh
EOF
