@echo off
setlocal
cd /d "%~dp0.."
echo Converting 爪/*.jcd to companion OBJ meshes...
python scripts\convert_jcd_to_mesh.py --subdir 爪 --force -v
if errorlevel 1 (
  echo Conversion failed.
  exit /b 1
)
echo Done. Restart business-service if it is running to refresh inlay cache.
endlocal
