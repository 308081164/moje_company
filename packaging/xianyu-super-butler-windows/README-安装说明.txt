Xianyu Super Butler - Windows installer notes
=============================================

1) No system Python required. This build ships an embedded CPython under:
   runtime\python312\
   Dependencies go to folder python_packages via pip --target; Launch.bat sets
   PYTHONPATH to that folder and always runs runtime\python312\python.exe.
   We do not use .venv because embed + virtualenv often breaks Scripts\python.exe.

2) First launch needs Internet so pip can fill python_packages from requirements.txt.
   The embed runtime python312._pth includes a line so sys.path sees python_packages
   without relying on PYTHONPATH alone.

3) If import still fails after pip, open python_packages\_import_check_err.txt in the
   install folder for the Python traceback.

4) If python.exe shows application error 0xc0000142 or similar, install Microsoft
   Visual C++ 2015-2022 Redistributable x64 from Microsoft, then retry.

5) After start, the script waits a few seconds then opens http://127.0.0.1:8080/
   If the page is blank, wait longer and refresh (slow first pip install).

6) The server runs in a minimized window. Close that window to stop the service.

7) If you used an older installer that created .venv, delete the .venv folder
   in the install directory to avoid confusion; it is no longer used.

8) Optional: apply patches\xianyu-super-butler\db_manager-receiver_city.patch to
   upstream db_manager.py before building if you hit /analytics/orders errors on old DBs.

9) Build (developer machine):
   cd packaging\xianyu-super-butler-windows
   .\build-installer.ps1 -SourceRoot "D:\path\to\xianyu-super-butler"
   If get-pip times out to pypi.org, retry with mirror:
   .\build-installer.ps1 -SourceRoot "D:\path\to\xianyu-super-butler" -UseTsinghuaPip
   Output: dist-installer\XianyuSuperButler-Setup-1.0.0.exe
   Simplified Chinese wizard uses Languages\ChineseSimplified.isl in this folder
   (bundled; no Inno built-in Chinese language file required).

10) Uninstall: Windows Settings -> Apps -> 闲鱼超级管家 -> Uninstall.
   Wizard is Simplified Chinese only. You will be asked whether to delete application
   data: Yes removes data, static\uploads, logs, backups; No keeps those folders.
   python_packages and .venv are always removed. Silent uninstall defaults to keeping data.
   Close the running server first if prompted. Backup data\ before uninstall if needed.
