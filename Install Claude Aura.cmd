@echo off
setlocal
set "AURA_INSTALLER=%~dp0windows\install.ps1"
cd /d "%LOCALAPPDATA%" 2>nul
if errorlevel 1 cd /d "%TEMP%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%AURA_INSTALLER%" -Launch
if errorlevel 1 (
  echo.
  echo Installation failed. Review the message above.
  pause
  exit /b 1
)
