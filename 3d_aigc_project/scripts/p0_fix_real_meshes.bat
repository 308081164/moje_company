@echo off
setlocal
cd /d "%~dp0.."
echo [P0] 批量重建 JCD 真实 mesh（移除 proxy，点云 Poisson）...
python scripts\regenerate_real_meshes.py --force
if errorlevel 1 (
  echo 部分 JCD 无法从点云重建（已删除 proxy，无假 3D），继续同步元数据...
)
echo.
echo [P0] 同步 mesh 元数据到 business-service...
curl -s -X POST "http://localhost:8854/api/inlay/v2/import/sync-mesh-metadata"
echo.
echo 完成。请刷新 http://localhost:8853/inlay-library
endlocal
