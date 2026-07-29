@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ==========================================
:: 3D AIGC 平台 - Windows环境初始化脚本
:: ==========================================

echo.
echo ============================================================
echo   3D AIGC 平台 - 环境初始化
echo ============================================================
echo.

:: ---------- 1. 检查Python ----------
echo [1/6] 检查Python环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Python，请先安装Python 3.9+
    echo        下载地址: https://www.python.org/downloads/
    goto :error
)
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYTHON_VER=%%v
echo [成功] Python %PYTHON_VER%
echo.

:: ---------- 2. 检查pip ----------
echo [2/6] 检查pip...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] pip未找到，尝试安装...
    python -m ensurepip --default-pip
    if %errorlevel% neq 0 (
        echo [错误] pip安装失败
        goto :error
    )
)
echo [成功] pip可用
echo.

:: ---------- 3. 检查Docker ----------
echo [3/6] 检查Docker环境...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到Docker Desktop
    echo        Docker仅在使用容器部署时需要
    echo        下载地址: https://www.docker.com/products/docker-desktop/
    set DOCKER_AVAILABLE=0
) else (
    for /f "tokens=3 delims= " %%v in ('docker --version') do set DOCKER_VER=%%v
    echo [成功] Docker %DOCKER_VER%
    set DOCKER_AVAILABLE=1

    :: 检查Docker Compose
    docker compose version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [警告] Docker Compose不可用
    ) else (
        echo [成功] Docker Compose可用
    )
)
echo.

:: ---------- 4. 检查NVIDIA GPU ----------
echo [4/6] 检查GPU环境...
nvidia-smi >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 未检测到NVIDIA GPU或驱动
    echo        GPU仅在使用AI推理时需要
) else (
    echo [成功] NVIDIA GPU已检测到
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>nul
)
echo.

:: ---------- 5. 创建.env文件 ----------
echo [5/6] 配置环境变量...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [成功] 已从 .env.example 创建 .env 文件
        echo        请根据实际情况修改 .env 中的配置
    ) else (
        echo [警告] .env.example 不存在，跳过环境变量配置
    )
) else (
    echo [跳过] .env 文件已存在
)
echo.

:: ---------- 6. 创建必要目录 ----------
echo [6/6] 创建项目目录...
if not exist models mkdir models
echo [成功] models/
if not exist outputs mkdir outputs
echo [成功] outputs/
if not exist uploads mkdir uploads
echo [成功] uploads/
echo.

:: ---------- 完成 ----------
echo ============================================================
echo   环境初始化完成！
echo ============================================================
echo.
echo   后续步骤:
echo.
echo   1. 检查硬件环境:
echo      python scripts/check-hardware.py
echo.
echo   2. 下载AI模型:
echo      python scripts/download-models.py
echo.
echo   3. 启动服务（Docker，默认强制 GPU）:
echo      start.bat
echo      或: docker compose up -d --build
echo      （主 compose 已含 GPU；紧急 CPU 才用 start.bat --cpu）
echo.
echo   4. 启动服务（开发模式）:
echo      cd frontend ^&^& npm install ^&^& npm run dev
echo.
echo ============================================================
echo.
goto :end

:error
echo.
echo ============================================================
echo   初始化过程中出现错误，请根据上方提示修复后重试
echo ============================================================
echo.
pause
exit /b 1

:end
pause
