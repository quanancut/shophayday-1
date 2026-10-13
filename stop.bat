@echo off
rem Tat may chu Kho Lang Hay Day dang chay ngam.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PY="
if exist "python\python.exe" set "PY=python\python.exe"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY (
  echo Chua cai dat. Hay chay run.bat truoc.
  pause
  exit /b 1
)
"%PY%" app.py --stop
timeout /t 4
