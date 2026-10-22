@echo off
cd /d "%~dp0"

echo ========================================================
echo   Installing Automatic GitHub Updater Scheduled Task
echo   Folder: %~dp0
echo ========================================================

set TASK_NAME=FourPoints-GitHub-AutoUpdate
set SCRIPT_PATH=%~dp0auto-update.bat

echo 1. Registering Windows Scheduled Task "%TASK_NAME%" (runs every 3 minutes)...
schtasks /Create /SC MINUTE /MO 3 /TN "%TASK_NAME%" /TR "\"%SCRIPT_PATH%\"" /F

echo.
echo 2. Running initial GitHub check and update right now...
call "%SCRIPT_PATH%"

echo.
echo ========================================================
echo   Done! "%TASK_NAME%" is active and checking GitHub
echo   every 3 minutes. Logs are saved in auto-update.log.
echo ========================================================
pause
