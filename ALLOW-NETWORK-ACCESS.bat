@echo off
title LESCO - Allow network access

REM ============================================================
REM  Run this ONCE, as administrator, on the PC that hosts the
REM  dashboard. It tells Windows Firewall to let other computers
REM  on the office network reach the two ports the app uses.
REM
REM  Right-click this file -> "Run as administrator".
REM ============================================================

net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [X] This must be run as administrator.
    echo.
    echo       Close this window, right-click ALLOW-NETWORK-ACCESS.bat
    echo       and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo.
echo   Allowing the LESCO dashboard through Windows Firewall...
echo   ^(port 8000 = the app; 5173 = the development server^)
echo.

REM remove any earlier copies so re-running does not stack up rules
netsh advfirewall firewall delete rule name="LESCO Dashboard (5173)" >nul 2>&1
netsh advfirewall firewall delete rule name="LESCO API (8000)"       >nul 2>&1

REM private/domain only - deliberately NOT public wifi
netsh advfirewall firewall add rule name="LESCO Dashboard (5173)" ^
    dir=in action=allow protocol=TCP localport=5173 profile=private,domain
netsh advfirewall firewall add rule name="LESCO API (8000)" ^
    dir=in action=allow protocol=TCP localport=8000 profile=private,domain

echo.
echo   Done. Colleagues on the same network can now open the
echo   address shown by START.bat.
echo.
echo   These rules apply to private and work networks only, not
echo   public wifi. To undo them later, run:
echo     netsh advfirewall firewall delete rule name="LESCO Dashboard (5173)"
echo     netsh advfirewall firewall delete rule name="LESCO API (8000)"
echo.
pause
