@echo off
setlocal
cd /d "%~dp0.."
echo ========================================
echo  镶嵌库全量处理：JCD -^> OBJ + 真实预览
echo ========================================
echo.
echo [1/2] 先刷新占位/低质量预览（BMP 优先，跳过已有真实预览）...
python scripts\convert_all_inlays.py --preview-only --workers 4
if errorlevel 1 (
  echo 预览阶段存在失败项，详见 scripts\convert_all_inlays_manifest.jsonl
)
echo.
echo [2/2] 为全部 JCD 生成伴生 OBJ（已有则跳过）...
python scripts\convert_all_inlays.py --mesh-only --workers 1
if errorlevel 1 (
  echo OBJ 阶段存在失败项，详见 manifest
)
echo.
echo [3/3] 对仍缺真实预览的项再次刷新（可用 mesh 渲染）...
python scripts\convert_all_inlays.py --preview-only --workers 4
echo.
echo 完成。请在镶嵌选择器点击刷新，或 POST /api/inlay/refresh
endlocal
