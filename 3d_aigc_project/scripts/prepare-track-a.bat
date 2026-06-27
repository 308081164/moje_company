@echo off
chcp 65001 >nul
echo ========================================
echo  轨道A 环境准备脚本
echo ========================================

cd /d "%~dp0.."

echo [1/4] 检查 Python...
python --version || (echo 请先安装 Python 3.10+ & exit /b 1)

echo [2/4] 安装 AI 服务依赖...
pip install -r ai-service\requirements.txt huggingface_hub modelscope

echo [3/4] 创建目录...
if not exist models mkdir models
if not exist uploads mkdir uploads
if not exist outputs mkdir outputs
if not exist .env copy .env.example .env

echo [4/4] 下载模型（需联网，约 2.7GB）...
python scripts\download-models.py --model hunyuan3d-2mini --use-modelscope
if errorlevel 1 (
  echo.
  echo 自动下载失败，请参考 docs\模型下载指南.md 手动下载
  python scripts\download-models.py --manual
)

python scripts\download-models.py --verify-only
echo.
echo 完成。详见 docs\轨道A开发指南.md
pause
