@echo off
echo ============================================
echo 珠宝定制管理系统 - 前端开发环境启动脚本
echo ============================================
echo.

REM 检查Node.js版本
echo 检查Node.js版本...
node --version 2>&1 | findstr "v" >nul
if errorlevel 1 (
    echo 错误: 未找到Node.js或Node.js版本不正确
    echo 请安装Node.js 18或更高版本
    pause
    exit /b 1
)

REM 检查npm
echo 检查npm...
npm --version 2>&1 | findstr "." >nul
if errorlevel 1 (
    echo 错误: 未找到npm
    echo 请安装Node.js（包含npm）
    pause
    exit /b 1
)

REM 检查后端服务
echo 检查后端服务...
curl -s http://localhost:8851/api/health >nul 2>&1
if errorlevel 1 (
    echo 警告: 后端服务未在 http://localhost:8851 运行
    echo 请确保后端服务已启动
    echo 按任意键继续启动前端（后端服务可稍后启动）...
    pause >nul
)

REM 安装依赖（如果node_modules不存在）
echo 检查依赖...
if not exist "node_modules" (
    echo 安装依赖...
    call npm install
    if errorlevel 1 (
        echo 错误: 依赖安装失败
        pause
        exit /b 1
    )
    echo 依赖安装成功！
) else (
    echo 依赖已安装，跳过安装步骤
)

echo.
echo 启动开发环境...
echo 前端开发服务器将在 http://localhost:3000 启动
echo Electron应用将自动启动
echo API地址: http://localhost:8851/api
echo.

REM 启动开发环境
call npm run dev

if errorlevel 1 (
    echo 错误: 开发环境启动失败
    pause
    exit /b 1
)