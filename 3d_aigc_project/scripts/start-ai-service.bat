@echo off
chcp 65001 >nul
cd /d "%~dp0..\ai-service"
set "HTTP_PROXY="
set "HTTPS_PROXY="
set "ALL_PROXY="
set "NO_PROXY=*"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "INLAY_DB_PATH=%~dp0..\镶嵌结构数据库"
set "MODEL_PATH=D:\Hui_Loading\moje_company\3d_aigc_project\models"
set "OFFLINE_MODE=true"
set "MODEL_VERSION=mv"
set "TRACK_A_GEOMETRY_ONLY=true"
rem 珠宝平滑默认（可选覆盖）: GEN_INFERENCE_STEPS=50 GEN_GUIDANCE_SCALE=4.5 GEN_OCTREE_RESOLUTION=384 GEN_MC_ALGO=dmc GEN_JEWELRY_SMOOTH_ITER=10
python -m app.main
