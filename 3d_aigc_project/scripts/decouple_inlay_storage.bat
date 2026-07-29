@echo off
setlocal
cd /d "%~dp0.."
echo [1/2] 将 legacy 资产复制到对象存储 uploads/inlay-storage ...
python scripts\rehydrate_inlay_storage.py --api http://localhost:8854 --force
if errorlevel 1 (
  echo rehydrate 失败，请勿删除「镶嵌结构数据库」文件夹
  exit /b 1
)
echo.
echo [2/2] 完成。可设置 legacy-fallback=false 并删除「镶嵌结构数据库/」文件夹。
echo 镶嵌库数据位于: business-service\data\inlay-catalog.db + uploads\inlay-storage\
endlocal
