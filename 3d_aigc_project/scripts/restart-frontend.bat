@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0.."
cd /d "%ROOT%"

if exist "%ROOT%\.tools\env.bat" (
    call "%ROOT%\.tools\env.bat"
) else (
    echo 请先运行 scripts\start-dev.bat 或 scripts\install-dev-tools.ps1 安装开发工具
    exit /b 1
)

echo 正在停止前端 (8853)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8853" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

if not exist "%ROOT%\frontend\node_modules" (
    echo 安装前端依赖...
    cd /d "%ROOT%\frontend"
    call npm install
    if errorlevel 1 exit /b 1
)

echo 启动前端 (8853)...
start "Frontend" cmd /k "cd /d %ROOT%\frontend && call %ROOT%\.tools\env.bat && npm run dev"

echo 前端重启中: http://localhost:8853
endlocal
