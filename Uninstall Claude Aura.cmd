@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\uninstall.ps1" -Interactive
if errorlevel 1 (
  echo.
  echo Uninstall failed. Review the message above.
  pause
  exit /b 1
)
echo.
pause
