@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo 停止 3D AIGC Docker 服务...

docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.gpu.yml --profile full down 2>nul
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile full down 2>nul
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile full down 2>nul
docker compose --profile full down 2>nul
docker compose down 2>nul

echo 已停止。
exit /b 0
