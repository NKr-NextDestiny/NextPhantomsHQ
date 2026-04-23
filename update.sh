#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${BRANCH:-main}"
MODE="${1:-update}"

log() { printf '\033[0;36m[INFO]\033[0m %s\n' "$1"; }
ok() { printf '\033[0;32m[ OK ]\033[0m %s\n' "$1"; }
err() { printf '\033[0;31m[ERR ]\033[0m %s\n' "$1"; exit 1; }

install_docker_debian() {
  log "Installiere Docker + Compose Plugin fuer Debian..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
}

cd "$REPO_DIR"

if ! command -v git >/dev/null 2>&1; then
  if [ "$MODE" = "install" ] && command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y git
  else
    err "git fehlt"
  fi
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  if [ "$MODE" = "install" ] && command -v apt-get >/dev/null 2>&1; then
    install_docker_debian
  else
    err "docker oder docker compose fehlt"
  fi
fi

if [ ! -f .env ]; then
  cp .env.example .env
  ok ".env aus .env.example erstellt"
fi

log "Hole neuesten Stand von origin/$BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Baue und starte Docker-Stack..."
docker compose up -d --build

log "Fuehre Prisma Migrationen im Server-Container aus..."
docker compose exec -T server sh -lc "cd server && npx prisma migrate deploy && npx prisma generate"

ok "Deployment abgeschlossen"
echo "App: http://localhost"
echo "API: http://localhost/api/health"
