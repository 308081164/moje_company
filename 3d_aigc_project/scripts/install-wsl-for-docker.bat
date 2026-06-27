@echo off
chcp 65001 >nul
echo ========================================
echo  WSL2 安装（Docker 前置依赖）
echo ========================================
echo.
echo 本脚本需要管理员权限。请在 UAC 弹窗中点击「是」。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0install-wsl-for-docker.ps1\"' -Wait"

echo.
echo 若上方窗口已提示完成，请重启电脑后再启动 Docker Desktop。
pause
