@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Next Phantoms HQ - Clean / Uninstall
color 0C

echo ============================================
echo   Next Phantoms HQ - CLEAN / UNINSTALL
echo ============================================
echo.
echo WARNUNG: Dies loescht ALLES:
echo   - Docker Container und Volumes (PostgreSQL Daten!)
echo   - node_modules
echo   - Build-Artefakte (.next, dist)
echo   - Generierte Prisma Dateien
echo   - Upload-Dateien
echo   - pnpm Lock-Datei
echo.

set /p CONFIRM="Bist du sicher? (y/n): "
if /i "!CONFIRM!"=="y" goto :confirmed
if /i "!CONFIRM!"=="j" goto :confirmed
echo Abgebrochen.
pause
exit /b 0
:confirmed

echo.
echo ============================================
echo   1. Docker Container stoppen und loeschen
echo ============================================
echo.

where docker >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Stoppe Docker Container...
    docker compose down -v --remove-orphans 2>nul
    if %ERRORLEVEL%==0 (
        echo [OK] Docker Container und Volumes geloescht
    ) else (
        echo [INFO] Keine Docker Container gefunden
    )

    :: Remove dangling images
    echo Entferne Docker Images...
    for /f "tokens=*" %%i in ('docker images -q "nextphantomshq*" 2^>nul') do (
        docker rmi %%i 2>nul
    )
    echo [OK] Docker Images bereinigt
) else (
    echo [INFO] Docker nicht verfuegbar, ueberspringe...
)

echo.
echo ============================================
echo   2. node_modules loeschen
echo ============================================
echo.

if exist node_modules (
    echo Loesche root node_modules...
    rmdir /s /q node_modules
    echo [OK] root node_modules geloescht
)

if exist client\node_modules (
    echo Loesche client node_modules...
    rmdir /s /q client\node_modules
    echo [OK] client node_modules geloescht
)

if exist server\node_modules (
    echo Loesche server node_modules...
    rmdir /s /q server\node_modules
    echo [OK] server node_modules geloescht
)

if exist shared\node_modules (
    echo Loesche shared node_modules...
    rmdir /s /q shared\node_modules
    echo [OK] shared node_modules geloescht
)

echo.
echo ============================================
echo   3. Build-Artefakte loeschen
echo ============================================
echo.

if exist client\.next (
    rmdir /s /q client\.next
    echo [OK] client/.next geloescht
)

if exist server\dist (
    rmdir /s /q server\dist
    echo [OK] server/dist geloescht
)

if exist shared\dist (
    rmdir /s /q shared\dist
    echo [OK] shared/dist geloescht
)

echo.
echo ============================================
echo   4. Generierte Dateien loeschen
echo ============================================
echo.

if exist server\src\generated (
    rmdir /s /q server\src\generated
    echo [OK] Prisma generated client geloescht
)

echo.
echo ============================================
echo   5. Uploads loeschen
echo ============================================
echo.

if exist server\uploads (
    rmdir /s /q server\uploads
    echo [OK] Upload-Verzeichnis geloescht
)

echo.
echo ============================================
echo   6. Lock-Dateien loeschen
echo ============================================
echo.

if exist pnpm-lock.yaml (
    del /f pnpm-lock.yaml
    echo [OK] pnpm-lock.yaml geloescht
)

echo.
echo ============================================
echo   CLEAN ABGESCHLOSSEN!
echo ============================================
echo.
echo Alles wurde bereinigt. Um neu zu starten:
echo   dev.bat
echo.
pause
