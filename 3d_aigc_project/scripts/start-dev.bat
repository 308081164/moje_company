@echo off
chcp 65001 >nul
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NO_PROXY=*"
setlocal EnableDelayedExpansion

set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo ========================================
echo  恒鎏珠宝3d生成工具 - 本地开发启动
echo ========================================

:: --- 加载本地开发工具 ---
if exist "%ROOT%\.tools\env.bat" (
    call "%ROOT%\.tools\env.bat"
) else (
    echo [0/5] 首次运行，下载 JDK / Maven / Node 到 .tools ...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\install-dev-tools.ps1"
    if errorlevel 1 exit /b 1
    call "%ROOT%\.tools\env.bat"
)

:: --- 检查 Python ---
echo [1/5] 检查 Python...
python --version >nul 2>&1 || (echo 请先安装 Python 3.10+ & exit /b 1)

:: --- AI 依赖 ---
echo [2/5] 检查 AI 服务依赖...
python -c "import fastapi, torch" >nul 2>&1
if errorlevel 1 (
    echo 安装 AI 依赖（首次较慢，含 PyTorch）...
    pip install -r ai-service\requirements.txt
    if errorlevel 1 exit /b 1
)

:: --- 前端依赖 ---
echo [3/5] 检查前端依赖...
if not exist frontend\node_modules (
    cd frontend
    call npm install
    if errorlevel 1 exit /b 1
    cd ..
)

:: --- 创建目录 ---
if not exist uploads mkdir uploads
if not exist outputs mkdir outputs
if not exist business-service\uploads mkdir business-service\uploads
if not exist business-service\outputs mkdir business-service\outputs

:: --- 启动 AI 服务 ---
echo [4/5] 启动 AI 服务 (8855)...
start "AI-Service" cmd /k "cd /d %ROOT%\ai-service && set INLAY_DB_PATH=../镶嵌结构数据库 && set MODEL_PATH=../models && set OFFLINE_MODE=true && set MODEL_VERSION=mv && set TRACK_A_GEOMETRY_ONLY=true && python -m app.main"

:: --- 启动业务服务 ---
echo [4/5] 启动业务服务 (8854)...
start "Business-Service" cmd /k "cd /d %ROOT%\business-service && call %ROOT%\.tools\env.bat && mvn -q spring-boot:run"

:: --- 等待后端就绪 ---
echo 等待后端启动...
timeout /t 15 /nobreak >nul

:: --- 启动前端 ---
echo [5/5] 启动前端 (8853)...
start "Frontend" cmd /k "cd /d %ROOT%\frontend && call %ROOT%\.tools\env.bat && npm run dev"

echo.
echo ========================================
echo  服务已启动
echo  前端: http://localhost:8853
echo  业务 API: http://localhost:8854
echo  AI 服务: http://localhost:8855/docs
echo ========================================
echo  三个命令行窗口请勿关闭。AI 模型加载需 1-3 分钟。
echo.
start http://localhost:8853
pause
