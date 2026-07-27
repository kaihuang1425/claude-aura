@echo off
setlocal
node.exe "%~dp0build-update.mjs" %*
exit /b %errorlevel%
