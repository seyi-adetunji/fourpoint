@echo off
setlocal EnableDelayedExpansion

:: Always operate in the repository folder (e.g. C:\workforce\fourpoint)
cd /d "%~dp0"

set LOG_FILE=%~dp0auto-update.log

:: Keep log file from growing endlessly (reset if > 500KB)
if exist "%LOG_FILE%" (
    for %%A in ("%LOG_FILE%") do if %%~zA GTR 512000 del /f /q "%LOG_FILE%"
)

:: Remove any stale git lock left by an interrupted process
if exist ".git\index.lock" (
    echo [%date% %time%] Removing stale .git\index.lock >> "%LOG_FILE%"
    del /f /q ".git\index.lock" >nul 2>&1
)

:: 1. Fetch latest commits from GitHub main branch
git fetch origin main >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] [WARN] git fetch origin main failed - check internet connection. >> "%LOG_FILE%"
    exit /b 1
)

:: 2. Get current local commit and latest GitHub origin/main commit
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set LOCAL_SHA=%%i
for /f "tokens=*" %%i in ('git rev-parse --short origin/main 2^>nul') do set REMOTE_SHA=%%i

:: 3. Check if server is currently listening on port 3000
set SERVER_RUNNING=0
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if not errorlevel 1 set SERVER_RUNNING=1

if "%LOCAL_SHA%"=="%REMOTE_SHA%" (
    if "!SERVER_RUNNING!"=="1" (
        echo [%date% %time%] [OK] Up to date at commit %LOCAL_SHA% and server is running on port 3000. >> "%LOG_FILE%"
        exit /b 0
    ) else (
        echo [%date% %time%] [WARN] Code is at %LOCAL_SHA% but port 3000 is not listening. Starting server... >> "%LOG_FILE%"
        goto :RESTART_SERVER
    )
)

echo ====================================================================== >> "%LOG_FILE%"
echo [%date% %time%] [UPDATE] New GitHub commit detected: %LOCAL_SHA% -^> %REMOTE_SHA% >> "%LOG_FILE%"
echo Updating C:\workforce\fourpoint from %LOCAL_SHA% to %REMOTE_SHA%...

:: 4. Stop Node.js first so Windows unlocks .next and Prisma query_engine DLLs
taskkill /F /IM node.exe >> "%LOG_FILE%" 2>&1
timeout /t 2 /nobreak >nul

:: 5. Force reset working tree to origin/main so local file changes never block git pull
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
git reset --hard origin/main >> "%LOG_FILE%" 2>&1

:: 6. Regenerate Prisma client and clear Next.js cache
echo [%date% %time%] [UPDATE] Cleaning .next cache and regenerating Prisma client... >> "%LOG_FILE%"
if exist ".next" rmdir /S /Q ".next" >nul 2>&1
call npx prisma generate >> "%LOG_FILE%" 2>&1

:RESTART_SERVER
echo [%date% %time%] [START] Launching Workforce Server (npm run dev)... >> "%LOG_FILE%"
start "FourPoints Workforce Server" /MIN cmd /c "cd /d "%~dp0" && npm run dev"
echo [%date% %time%] [SUCCESS] Server updated to %REMOTE_SHA% and started. >> "%LOG_FILE%"
exit /b 0
