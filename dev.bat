@echo off
setlocal enabledelayedexpansion
title NextPhantoms - Dev Setup
color 0A

echo ============================================
echo   NextPhantoms - Development Setup
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js nicht gefunden! Bitte installiere Node.js 20+
    echo https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%a in ('node -v') do set NODE_VER=%%a
echo [OK] Node.js gefunden: %NODE_VER%

:: Check pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] pnpm nicht gefunden, installiere...
    npm install -g pnpm@latest
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pnpm Installation fehlgeschlagen!
        pause
        exit /b 1
    )
)
echo [OK] pnpm gefunden

:: Check Docker
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARN] Docker nicht gefunden - PostgreSQL muss manuell laufen!
    set DOCKER_AVAILABLE=0
) else (
    echo [OK] Docker gefunden
    set DOCKER_AVAILABLE=1
)

echo.
echo ============================================
echo   1. Environment Setup
echo ============================================
echo.

:: Create .env if not exists
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] .env erstellt aus .env.example
        echo [WICHTIG] Bitte .env bearbeiten und Discord Credentials eintragen!
        echo.
        echo Benoetigte Werte:
        echo   - DISCORD_CLIENT_ID
        echo   - DISCORD_CLIENT_SECRET
        echo   - REQUIRED_GUILD_ID
        echo   - ALLOWED_ROLE_IDS (optional)
        echo   - ADMIN_ROLE_IDS (optional)
        echo.
        set /p EDIT_ENV="Moechtest du die .env jetzt bearbeiten? (j/n): "
        if /i "!EDIT_ENV!"=="j" (
            notepad .env
            echo Druecke Enter wenn du fertig bist...
            pause >nul
        )
    ) else (
        echo [ERROR] .env.example nicht gefunden!
        pause
        exit /b 1
    )
) else (
    echo [OK] .env existiert bereits
)

echo.
echo ============================================
echo   2. Dependencies installieren
echo ============================================
echo.

call pnpm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm install fehlgeschlagen!
    pause
    exit /b 1
)
echo [OK] Dependencies installiert

echo.
echo ============================================
echo   3. Shared Package bauen
echo ============================================
echo.

call pnpm --filter shared build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Shared build fehlgeschlagen!
    pause
    exit /b 1
)
echo [OK] Shared package gebaut

echo.
echo ============================================
echo   4. PostgreSQL starten
echo ============================================
echo.

if %DOCKER_AVAILABLE%==1 (
    echo Starte PostgreSQL via Docker...
    docker compose up -d postgres
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] PostgreSQL konnte nicht gestartet werden!
        pause
        exit /b 1
    )
    :: Wait for PostgreSQL to be ready
    echo Warte auf PostgreSQL...
    timeout /t 5 /nobreak >nul
    echo [OK] PostgreSQL laeuft
) else (
    echo [WARN] Docker nicht verfuegbar - stelle sicher dass PostgreSQL auf Port 5432 laeuft!
    echo   DB_USER=phantoms  DB_PASSWORD=changeme  DB_NAME=next_phantoms
    pause
)

echo.
echo ============================================
echo   5. Prisma Setup
echo ============================================
echo.

cd server
call pnpm prisma generate
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Prisma generate fehlgeschlagen!
    cd ..
    pause
    exit /b 1
)
echo [OK] Prisma Client generiert

call pnpm prisma migrate dev --name init
if %ERRORLEVEL% neq 0 (
    echo [WARN] Migration fehlgeschlagen - pruefe DATABASE_URL in .env
    echo   Fuer lokales Dev: DATABASE_URL=postgresql://phantoms:changeme@localhost:5432/next_phantoms
    cd ..
    pause
    exit /b 1
)
echo [OK] Datenbank migriert
cd ..

echo.
echo ============================================
echo   6. File Encryption Key generieren
echo ============================================
echo.

:: Check if FILE_ENCRYPTION_KEY is set in .env
findstr /c:"FILE_ENCRYPTION_KEY=" .env | findstr /v /c:"FILE_ENCRYPTION_KEY=$" | findstr /v /c:"FILE_ENCRYPTION_KEY= " >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Generiere Encryption Key...
    for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set ENCKEY=%%i
    echo [INFO] Encryption Key: !ENCKEY!
    echo [INFO] Bitte in .env unter FILE_ENCRYPTION_KEY eintragen!
)

echo.
echo ============================================
echo   7. Uploads-Verzeichnis erstellen
echo ============================================
echo.

if not exist server\uploads mkdir server\uploads
echo [OK] Upload-Verzeichnis bereit

echo.
echo ============================================
echo   SETUP ABGESCHLOSSEN!
echo ============================================
echo.
echo Starte den Dev-Server mit:
echo   pnpm dev
echo.
echo Oder starte jetzt direkt:
set /p START_DEV="Dev-Server jetzt starten? (j/n): "
if /i "!START_DEV!"=="j" (
    echo.
    echo Starte NextPhantoms...
    echo   Client: http://localhost:3000
    echo   Server: http://localhost:4000
    echo.
    call pnpm dev
) else (
    echo.
    echo Spaeter starten mit: pnpm dev
    pause
)
