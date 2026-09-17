@echo off
setlocal EnableDelayedExpansion
title LESCO Meter Data Analyzer

REM ============================================================
REM  Runs the WHOLE app (dashboard + analysis) from ONE server.
REM  Needs Python only - no Node.js, no internet, no admin.
REM
REM  The dashboard is pre-built into
REM    Frontend\lesco-mdm-frontend\dist
REM  The Python engine lives in backend\ .
REM  and Python serves it, so this folder can simply be copied
REM  to another PC and run.
REM ============================================================

cd /d "%~dp0"

echo.
echo   LESCO Meter Data Analyzer
echo   ==============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo   [X] Python was not found.
    echo.
    echo       Install Python 3.11 or newer from python.org
    echo       and TICK "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

if not exist "Frontend\lesco-mdm-frontend\dist\index.html" (
    echo   [X] The dashboard has not been built.
    echo.
    echo       This folder is missing:
    echo         Frontend\lesco-mdm-frontend\dist
    echo.
    echo       Copy that folder from a PC where it exists, or run
    echo       "npm run build" in Frontend\lesco-mdm-frontend.
    echo.
    pause
    exit /b 1
)

python -c "import fastapi, uvicorn, pandas, openpyxl, multipart" >nul 2>&1
if errorlevel 1 (
    echo   Installing the Python packages. This happens on the FIRST RUN
    echo   only, needs internet, and takes about a minute.
    echo.
    echo   If it stops here for a long time, this PC probably cannot reach
    echo   the internet - see SETUP-ON-ANOTHER-PC.txt for the offline method.
    echo.
    REM Bounded retries/timeout: on a restricted office network pip otherwise
    REM retries for many minutes and looks like a hang.
    python -m pip install -r requirements.txt --retries 2 --timeout 20
    echo.
    python -c "import fastapi, uvicorn, pandas, openpyxl, multipart" >nul 2>&1
    if errorlevel 1 (
        echo   [X] The packages did not install.
        echo.
        echo       This PC most likely has no internet access, or a proxy
        echo       is blocking it. See SETUP-ON-ANOTHER-PC.txt, section
        echo       "NO INTERNET ON THAT PC", for how to copy the packages
        echo       across on the USB stick instead.
        echo.
        pause
        exit /b 1
    )
)

REM ---------- this PC's network address, for sharing ----------
set "LANIP="
set "_IPFILE=%TEMP%\lesco_lanip.txt"
powershell -NoProfile -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'VMware|VirtualBox|Hyper-V|vEthernet|Loopback' } | Select-Object -First 1 -ExpandProperty IPAddress; if ($ip) { Set-Content -LiteralPath $env:TEMP\lesco_lanip.txt -Value $ip -Encoding ASCII }" >nul 2>&1
if exist "%_IPFILE%" for /f "usebackq delims=" %%A in ("%_IPFILE%") do set "LANIP=%%A"
del "%_IPFILE%" >nul 2>&1

echo   Starting...
start "LESCO Server  -  open http://localhost:8000" /min cmd /c "cd /d "%~dp0backend" && python -m uvicorn api:app --host 0.0.0.0 --port 8000"

REM ---------- wait for it to answer, then open the browser ----------
set "READY="
for /l %%i in (1,1,40) do (
    if not defined READY (
        ping -n 2 127.0.0.1 >nul
        curl -s -o nul -m 2 http://127.0.0.1:8000/api/health >nul 2>&1
        if not errorlevel 1 set "READY=1"
    )
)

if defined READY (
    start "" http://localhost:8000
) else (
    echo   Still starting - open http://localhost:8000 yourself.
)

echo.
echo   ##############################################
echo   #                                            #
echo   #   OPEN THIS ADDRESS:                       #
echo   #                                            #
echo   #       http://localhost:8000                #
echo   #                                            #
echo   ##############################################
echo.
if defined LANIP echo   Others can use:    http://%LANIP%:8000
echo.
echo   For others to connect, run ALLOW-NETWORK-ACCESS.bat
echo   once as administrator on this PC.
echo.
echo   To stop: close the window titled "LESCO Server".
echo   ==============================================
echo.
echo   Keep this window open for reference - closing it does NOT
echo   stop the app.
echo.
pause
