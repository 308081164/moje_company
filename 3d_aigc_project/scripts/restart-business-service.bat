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

echo 正在停止业务服务 (8854)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8854" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo 启动业务服务 (8854)...
start "Business-Service" cmd /k "cd /d %ROOT%\business-service && call %ROOT%\.tools\env.bat && mvn -q spring-boot:run"

echo 业务服务重启中，API: http://localhost:8854
endlocal
