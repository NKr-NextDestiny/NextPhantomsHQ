@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title Next Phantoms HQ - Clean / Uninstall
color 0C

echo ============================================
echo   Next Phantoms HQ - CLEAN
echo ============================================
echo.
echo Was möchtest du löschen?
echo.
echo   [1] Nur Daten (DB-Volumes, Uploads)
echo   [2] Alles (DB, Uploads, node_modules, Builds, Lock-Datei, Docker Images)
echo   [3] Abbrechen
echo.

set /p CHOICE="Auswahl (1/2/3): "

if "!CHOICE!"=="3" goto :cancelled
if "!CHOICE!"=="1" goto :data_only
if "!CHOICE!"=="2" goto :full_clean
echo Ungültige Auswahl.
pause
exit /b 0

:cancelled
echo Abgebrochen.
pause
exit /b 0

:: ============================================
:: OPTION 1: Nur Daten löschen
:: ============================================
:data_only
echo.
echo WARNUNG: Dies löscht die Datenbank und alle Uploads!
set /p CONFIRM="Bist du sicher? (y/n): "
if /i "!CONFIRM!"=="y" goto :data_confirmed
if /i "!CONFIRM!"=="j" goto :data_confirmed
echo Abgebrochen.
pause
exit /b 0

:data_confirmed
echo.

:: Docker DB Volume löschen
where docker >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Stoppe und lösche PostgreSQL Container + Volume...
    docker compose down -v --remove-orphans 2>nul
    echo [OK] Datenbank gelöscht
) else (
    echo [INFO] Docker nicht verfügbar
)

:: Uploads löschen
if exist server\uploads (
    rmdir /s /q server\uploads
    echo [OK] Uploads gelöscht
)

echo.
echo ============================================
echo   DATEN GELÖSCHT
echo ============================================
echo.
echo Datenbank und Uploads wurden entfernt.
echo Starte dev.bat um alles neu aufzusetzen.
echo.
pause
exit /b 0

:: ============================================
:: OPTION 2: Alles löschen
:: ============================================
:full_clean
echo.
echo WARNUNG: Dies löscht ALLES:
echo   - Docker Container, Volumes und Images
echo   - Datenbank (PostgreSQL Daten)
echo   - node_modules (alle Pakete)
echo   - Build-Artefakte (.next, dist)
echo   - Generierte Prisma Dateien
echo   - Upload-Dateien
echo   - pnpm Lock-Datei
echo.
set /p CONFIRM="Bist du sicher? (y/n): "
if /i "!CONFIRM!"=="y" goto :full_confirmed
if /i "!CONFIRM!"=="j" goto :full_confirmed
echo Abgebrochen.
pause
exit /b 0

:full_confirmed
echo.
echo ============================================
echo   1. Docker Container stoppen und löschen
echo ============================================
echo.

where docker >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Stoppe Docker Container...
    docker compose down -v --remove-orphans 2>nul
    if %ERRORLEVEL%==0 (
        echo [OK] Docker Container und Volumes gelöscht
    ) else (
        echo [INFO] Keine Docker Container gefunden
    )

    echo Entferne Docker Images...
    for /f "tokens=*" %%i in ('docker images -q "nextphantomshq*" 2^>nul') do (
        docker rmi %%i 2>nul
    )
    echo [OK] Docker Images bereinigt
) else (
    echo [INFO] Docker nicht verfügbar, überspringe...
)

echo.
echo ============================================
echo   2. node_modules löschen
echo ============================================
echo.

if exist node_modules (
    echo Lösche root node_modules...
    rmdir /s /q node_modules
    echo [OK] root node_modules gelöscht
)

if exist client\node_modules (
    echo Lösche client node_modules...
    rmdir /s /q client\node_modules
    echo [OK] client node_modules gelöscht
)

if exist server\node_modules (
    echo Lösche server node_modules...
    rmdir /s /q server\node_modules
    echo [OK] server node_modules gelöscht
)

if exist shared\node_modules (
    echo Lösche shared node_modules...
    rmdir /s /q shared\node_modules
    echo [OK] shared node_modules gelöscht
)

echo.
echo ============================================
echo   3. Build-Artefakte löschen
echo ============================================
echo.

if exist client\.next (
    rmdir /s /q client\.next
    echo [OK] client/.next gelöscht
)

if exist server\dist (
    rmdir /s /q server\dist
    echo [OK] server/dist gelöscht
)

if exist shared\dist (
    rmdir /s /q shared\dist
    echo [OK] shared/dist gelöscht
)

echo.
echo ============================================
echo   4. Generierte Dateien löschen
echo ============================================
echo.

if exist server\src\generated (
    rmdir /s /q server\src\generated
    echo [OK] Prisma generated client gelöscht
)

echo.
echo ============================================
echo   5. Uploads löschen
echo ============================================
echo.

if exist server\uploads (
    rmdir /s /q server\uploads
    echo [OK] Upload-Verzeichnis gelöscht
)

echo.
echo ============================================
echo   6. Lock-Dateien löschen
echo ============================================
echo.

if exist pnpm-lock.yaml (
    del /f pnpm-lock.yaml
    echo [OK] pnpm-lock.yaml gelöscht
)

echo.
echo ============================================
echo   ALLES GELÖSCHT
echo ============================================
echo.
echo Komplett bereinigt. Um neu zu starten:
echo   dev.bat
echo.
pause
