@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0.."
cd /d "%ROOT%\ai-service"

echo 正在停止 AI 服务 (8855)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8855" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo 启动 AI 服务 (8855)...
start "AI-Service" cmd /k "cd /d %ROOT%\ai-service && call %ROOT%\scripts\start-ai-service.bat"

echo AI 服务重启中，API: http://localhost:8855
endlocal
