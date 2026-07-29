@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "MODE=default"
set "USE_GPU=1"
rem 主 compose 已内置 GPU；gpu.yml 为冗余兼容叠加
set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.gpu.yml"
set "EXTRA_ENV="

:parse_args
if "%~1"=="" goto run
if /i "%~1"=="--full" (
    set "MODE=full"
    set "EXTRA_ENV=COMPOSE_PROFILES=full SPRING_PROFILES_ACTIVE=docker,docker-full"
    shift
    goto parse_args
)
if /i "%~1"=="--dev" (
    set "MODE=dev"
    call :rebuild_compose
    shift
    goto parse_args
)
if /i "%~1"=="--cpu" (
    set "USE_GPU=0"
    call :rebuild_compose
    shift
    goto parse_args
)
if /i "%~1"=="--gpu" (
    rem 兼容旧参数：GPU 已是默认，显式指定时强制启用
    set "USE_GPU=1"
    call :rebuild_compose
    shift
    goto parse_args
)
if /i "%~1"=="--help" (
    goto help
)
shift
goto parse_args

:rebuild_compose
if "!USE_GPU!"=="1" (
    if /i "!MODE!"=="dev" (
        set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.dev.yml"
    ) else (
        set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.gpu.yml"
    )
) else (
    if /i "!MODE!"=="dev" (
        set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.cpu.yml -f docker-compose.dev.yml"
    ) else (
        set "COMPOSE_FILES=-f docker-compose.yml -f docker-compose.cpu.yml"
    )
)
goto :eof

:run
if "%USE_GPU%"=="1" (
    set "ACCEL=GPU"
) else (
    set "ACCEL=CPU"
)

echo ========================================
echo  恒鎏珠宝 3D AIGC - Docker 一键启动
echo  模式: %MODE%  ^|  加速: %ACCEL%
echo ========================================

docker --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo        可运行 scripts\install-wsl-for-docker.bat 安装 WSL2 前置依赖
    exit /b 1
)

if not exist "%ROOT%\.env" (
    if exist "%ROOT%\.env.example" (
        echo [提示] 未找到 .env，从 .env.example 复制...
        copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
    )
)

if not exist "%ROOT%\uploads" mkdir "%ROOT%\uploads"
if not exist "%ROOT%\outputs" mkdir "%ROOT%\outputs"

if "%USE_GPU%"=="1" (
    echo [提示] 默认强制 GPU（docker-compose.yml 已内置 device reservation + REQUIRE_GPU=1）
    echo        需 NVIDIA Container Toolkit。紧急无 GPU 才用: start.bat --cpu
) else (
    echo.
    echo ************************************************************************
    echo * 警告：正在以紧急 CPU 模式启动（REQUIRE_GPU=0）
    echo * CPU 推理极慢：FAST 模式也可能接近 1 小时，严禁用于日常或 Agent 重启
    echo * 仅在无 NVIDIA GPU / Toolkit 不可用时的应急手段
    echo ************************************************************************
    echo.
)

echo [1/3] 校验 compose 配置...
docker compose %COMPOSE_FILES% config >nul
if errorlevel 1 (
    echo [错误] docker compose config 校验失败
    if "%USE_GPU%"=="1" (
        echo        GPU 模式需要已安装 NVIDIA Container Toolkit。
        echo        紧急无 GPU 时可改用: start.bat --cpu
    )
    exit /b 1
)

echo [2/3] 构建并启动全部服务...
if "%MODE%"=="full" (
    set COMPOSE_PROFILES=full
    set SPRING_PROFILES_ACTIVE=docker,docker-full
)
docker compose %COMPOSE_FILES% up -d --build
if errorlevel 1 (
    if "%USE_GPU%"=="1" (
        echo [错误] GPU 启动失败。请确认 NVIDIA Toolkit / Docker GPU 支持可用，
        echo        紧急才改用 CPU: start.bat --cpu
    )
    exit /b 1
)

if "%USE_GPU%"=="1" (
    echo [3/3] 验证 AI 服务 GPU（/health gpu_available）...
    set "GPU_OK=0"
    for /L %%i in (1,1,60) do (
        if "!GPU_OK!"=="0" (
            powershell -NoProfile -Command "try { $h = Invoke-RestMethod -Uri 'http://localhost:8855/health' -TimeoutSec 3; if ($h.gpu_available -eq $true) { exit 0 } else { exit 2 } } catch { exit 1 }" >nul 2>&1
            set "EC=!errorlevel!"
            if "!EC!"=="0" set "GPU_OK=1"
            if "!EC!"=="2" (
                echo [错误] 健康检查报告 gpu_available=false，服务未使用 GPU
                echo        请检查 DeviceRequests / NVIDIA Toolkit，勿在 CPU 上推理
                echo        查看日志: docker compose %COMPOSE_FILES% logs ai-service
                exit /b 1
            )
            if "!GPU_OK!"=="0" (
                timeout /t 5 /nobreak >nul
            )
        )
    )
    if "!GPU_OK!"=="0" (
        echo [错误] 等待 AI 健康检查超时，未能确认 gpu_available=true
        echo        查看日志: docker compose %COMPOSE_FILES% logs -f ai-service
        exit /b 1
    )
    echo        GPU 验证通过: gpu_available=true
) else (
    echo [3/3] 跳过 GPU 验证（紧急 CPU 模式）
)

echo.
echo ========================================
echo  服务已启动（%ACCEL%）
echo  前端:     http://localhost:8853
echo  业务 API: http://localhost:8854
echo  AI 文档:  http://localhost:8855/docs
echo  AI 健康:  http://localhost:8855/health
echo ========================================
echo.
echo  首次启动请导入镶嵌库 legacy 数据：
echo    curl -X POST http://localhost:8854/api/inlay/v2/import/scan-legacy
echo.
echo  查看日志: docker compose %COMPOSE_FILES% logs -f
echo  停止服务: stop.bat
echo.
exit /b 0

:help
echo 用法: start.bat [选项]
echo.
echo   （无参数）   默认最小集 + 强制 GPU（需 NVIDIA Toolkit）
echo   --full       启用 PostgreSQL + MinIO + Redis
echo   --dev        Vite 热更新前端（叠加 docker-compose.dev.yml）
echo   --cpu        紧急 CPU（叠加 docker-compose.cpu.yml，REQUIRE_GPU=0，极慢）
echo   --gpu        显式启用 GPU（默认已启用，保留兼容）
echo.
echo 示例:
echo   start.bat
echo   start.bat --full
echo   start.bat --cpu
echo   start.bat --dev --cpu
echo.
echo Agents: 重启请用本脚本或 docker compose up（主文件已含 GPU）。
echo         禁止省略 GPU 配置导致 DeviceRequests=null。
exit /b 0
