@echo off
setlocal
cd /d "%~dp0.."
echo Generating real mesh PNG previews for all OBJ inlay structures...
python scripts\generate_mesh_previews.py --force -v
if errorlevel 1 exit /b 1
echo Done. Click refresh in the inlay selector or POST /api/inlay/refresh
endlocal
