@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
title Next Phantoms HQ - Docker Dev

echo ============================================
echo   Next Phantoms HQ - Docker Dev
echo ============================================
echo.

where docker >nul 2>&1 || (
  echo [ERROR] Docker Desktop / docker CLI nicht gefunden.
  pause
  exit /b 1
)

docker info >nul 2>&1 || (
  echo [ERROR] Docker scheint nicht zu laufen. Bitte Docker Desktop starten.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo [OK] .env aus .env.example erstellt
  ) else (
    echo [ERROR] .env.example fehlt
    pause
    exit /b 1
  )
)

echo [INFO] Baue und starte Docker-Stack...
docker compose up -d --build
if %ERRORLEVEL% neq 0 (
  echo [ERROR] docker compose up fehlgeschlagen
  pause
  exit /b 1
)

echo.
echo [OK] Stack läuft
echo   App: http://localhost
echo   API: http://localhost:4000/api/health
echo.
echo [INFO] Live-Logs folgen. Mit CTRL+C beenden.
docker compose logs -f
