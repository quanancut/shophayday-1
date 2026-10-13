@echo off
rem ============================================================
rem  Kho Lang Hay Day - bam dup file nay de chay may chu.
rem  Tu kiem tra Python + thu vien, thieu thi tu cai, roi mo trinh duyet.
rem ============================================================
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Kho Lang Hay Day - may chu

set "PY_VER=3.12.10"
set "PY="
set "PYTHONUNBUFFERED=1"
set "PYTHONIOENCODING=utf-8"

echo ============================================================
echo   KHO LANG HAY DAY - khoi dong may chu
echo ============================================================

rem --- 1a. Moi truong ao .venv da co va con dung duoc ---
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -c "import sys" >nul 2>&1
  if not errorlevel 1 (
    set "PY=.venv\Scripts\python.exe"
    goto :deps
  )
)
if exist ".venv" (
  echo [!] Thu muc .venv bi hong hoac chep tu may khac, dang tao lai...
  rmdir /s /q ".venv"
)

rem --- 1b. Python portable trong thu muc du an ---
if exist "python\python.exe" (
  set "PY=python\python.exe"
  goto :deps
)

rem --- 1c. Python cai san tren Windows (ban 3.9 tro len) ---
set "SYSPY="
python -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" >nul 2>&1
if not errorlevel 1 set "SYSPY=python"
if not defined SYSPY (
  py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" >nul 2>&1
  if not errorlevel 1 set "SYSPY=py -3"
)
if not defined SYSPY goto :portable
echo [1/3] Tim thay Python tren may. Dang tao moi truong ao .venv...
%SYSPY% -m venv .venv
if exist ".venv\Scripts\python.exe" (
  set "PY=.venv\Scripts\python.exe"
  goto :deps
)
echo [!] Khong tao duoc .venv, chuyen sang tai Python portable.

rem --- 1d. Khong co Python: tai ban portable (khong can cai vao Windows) ---
:portable
echo [1/3] May chua co Python. Dang tai Python %PY_VER% portable (khoang 11 MB)...
set "ARCH=amd64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
if /i "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 set "ARCH=win32"
if exist "python" rmdir /s /q "python"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://www.python.org/ftp/python/%PY_VER%/python-%PY_VER%-embed-%ARCH%.zip' -OutFile 'python.zip' -UseBasicParsing; Expand-Archive 'python.zip' -DestinationPath 'python' -Force; Remove-Item 'python.zip'; $p=(Get-ChildItem 'python\python*._pth' | Select-Object -First 1).FullName; (Get-Content $p) -replace '^#\s*import site','import site' | Set-Content $p -Encoding ASCII; Invoke-WebRequest 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'python\get-pip.py' -UseBasicParsing"
if errorlevel 1 goto :fail_download
echo       Dang cai pip...
"python\python.exe" "python\get-pip.py" --no-warn-script-location -q
if errorlevel 1 goto :fail_download
set "PY=python\python.exe"

rem --- 2. Thu vien ---
:deps
echo [2/3] Kiem tra thu vien (Flask, Waitress)...
"%PY%" -c "import flask, waitress" >nul 2>&1
if not errorlevel 1 goto :ready
echo       Chua co, dang cai tu requirements.txt...
"%PY%" -m pip install --disable-pip-version-check --no-warn-script-location -q -r requirements.txt
if errorlevel 1 goto :fail_pip
"%PY%" -c "import flask, waitress" >nul 2>&1
if errorlevel 1 goto :fail_pip

:ready
if /i "%~1"=="import" goto :import
if /i "%~1"=="console" goto :console

rem --- 3. Chay may chu NGAM (dong cua so nay server van chay) ---
"%PY%" app.py --status >nul 2>&1
if not errorlevel 1 (
  echo [3/3] May chu dang chay san. Mo trinh duyet...
  "%PY%" app.py --open
  timeout /t 3 /nobreak >nul
  exit /b 0
)
for %%I in ("%PY%") do set "PYW=%%~dpIpythonw.exe"
if not exist "%PYW%" goto :console
echo [3/3] Khoi dong may chu chay ngam...
start "" "%PYW%" app.py --background
for /l %%i in (1,1,20) do (
  ping -n 2 127.0.0.1 >nul
  "%PY%" app.py --status >nul 2>&1
  if not errorlevel 1 goto :started
)
echo.
echo [LOI] May chu khong khoi dong duoc. Noi dung data\server.log:
echo ------------------------------------------------------------
if exist "data\server.log" powershell -NoProfile -Command "Get-Content 'data\server.log' -Tail 25 -Encoding UTF8"
pause
exit /b 1

:started
echo.
echo   May chu DANG CHAY NGAM tai http://localhost:8000 (cong doi trong config.ini)
echo   Ban co the dong cua so nay, web van hoat dong.
echo   Muon tat may chu: bam dup stop.bat
echo.
timeout /t 8
exit /b 0

rem --- Chay trong cua so (xem loi truc tiep): run.bat console ---
:console
echo [3/3] Khoi dong may chu trong cua so nay (dong cua so = tat may chu)...
"%PY%" app.py
echo.
echo May chu da dung.
pause
exit /b 0

:import
"%PY%" import_old.py "%~2"
pause
exit /b %errorlevel%

:fail_download
echo.
echo [LOI] Khong tai duoc Python. Kiem tra ket noi Internet roi chay lai run.bat.
echo       Hoac tu cai Python tu https://www.python.org/downloads/ (nho tich "Add python.exe to PATH").
if exist "python.zip" del /q "python.zip"
if exist "python" rmdir /s /q "python"
pause
exit /b 1

:fail_pip
echo.
echo [LOI] Khong cai duoc thu vien. Kiem tra ket noi Internet roi chay lai run.bat.
pause
exit /b 1
