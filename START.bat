@echo off
setlocal EnableDelayedExpansion
title LESCO Meter Data Analyzer

REM ============================================================
REM  Starts the backend (API) and the frontend (web dashboard),
REM  then opens the browser. Just double-click this file.
REM  Close the two black windows it opens to stop everything.
REM ============================================================

cd /d "%~dp0"

echo.
echo   LESCO Meter Data Analyzer
echo   ==============================================
echo.

REM ---------- find Python ----------
where python >nul 2>&1
if errorlevel 1 (
    echo   [X] Python was not found.
    echo       Install Python, or tick "Add Python to PATH" if it is installed.
    echo.
    pause
    exit /b 1
)

REM ---------- find Node / npm ----------
REM npm is usually not on PATH on this machine, so fall back to the
REM standard install folder before giving up.
where npm >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    ) else (
        echo   [X] Node.js was not found.
        echo       Install it from https://nodejs.org  ^(LTS version^)
        echo.
        pause
        exit /b 1
    )
)

set "FRONTEND=%~dp0Frontend\lesco-mdm-frontend"

if not exist "%FRONTEND%\package.json" (
    echo   [X] Frontend folder not found:
    echo       %FRONTEND%
    echo.
    pause
    exit /b 1
)

REM ---------- first run: install frontend packages ----------
if not exist "%FRONTEND%\node_modules" (
    echo   First run - installing frontend packages.
    echo   This happens once and takes a few minutes...
    echo.
    pushd "%FRONTEND%"
    call npm install
    popd
    echo.
)

REM ---------- start the two servers ----------
echo   Starting backend  ^(http://127.0.0.1:8000^) ...
start "LESCO Backend"  cmd /k "cd /d "%~dp0backend" && python -m uvicorn api:app --host 0.0.0.0 --port 8000"

echo   Starting frontend ^(http://localhost:5173^) ...
start "LESCO Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev -- --host 0.0.0.0"

REM ---------- work out this PC's LAN address (skip virtual adapters) ----------
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
  "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'VMware^|VirtualBox^|Hyper-V^|Loopback' } ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "LANIP=%%A"

REM ---------- wait for the frontend to answer, then open it ----------
echo.
echo   Waiting for the dashboard to come up...
set "READY="
for /l %%i in (1,1,40) do (
    if not defined READY (
        ping -n 2 127.0.0.1 >nul
        curl -s -o nul -m 2 http://localhost:5173/ >nul 2>&1
        if not errorlevel 1 set "READY=1"
    )
)

if defined READY (
    start "" http://localhost:5173
    echo   Dashboard opened in your browser.
) else (
    echo   Still starting up - open http://localhost:5173 in your browser.
)

echo.
echo   ==============================================
echo   On THIS computer:
echo     Dashboard: http://localhost:5173
echo.
if defined LANIP (
    echo   Share with others on the same network:
    echo     http://%LANIP%:5173
    echo.
    echo   [!] First time only: colleagues cannot connect until
    echo       Windows Firewall allows ports 5173 and 8000.
    echo       Right-click ALLOW-NETWORK-ACCESS.bat and pick
    echo       "Run as administrator" - once, on this PC only.
) else (
    echo   Could not detect a network address - this PC may be offline.
)
echo.
echo   Analysis always runs on THIS computer. Others just view it,
echo   so their machine speed does not matter.
echo.
echo   To stop: close the two windows titled
echo   "LESCO Backend" and "LESCO Frontend".
echo   ==============================================
echo.
ping -n 9 127.0.0.1 >nul
