#!/usr/bin/env bash
# 从 .env.example 生成仓库根目录 .env（不提交 Git）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env.example ]]; then
  echo "错误: 未找到 .env.example" >&2
  exit 1
fi
if [[ -f .env ]] && [[ "${1:-}" != "-f" ]]; then
  echo ".env 已存在。若要覆盖请执行: $0 -f" >&2
  exit 1
fi
cp -f .env.example .env
echo "已生成 $(pwd)/.env ，请用编辑器填写真实值后再启动 Docker / 后端。"
