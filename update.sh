#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="${BRANCH:-main}"
MODE="${1:-menu}"

log() { printf '\033[0;36m[INFO]\033[0m %s\n' "$1"; }
ok() { printf '\033[0;32m[ OK ]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$1"; }
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

ensure_requirements() {
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
}

do_update() {
  log "Hole neuesten Stand von origin/$BRANCH..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"

  log "Baue und starte Docker-Stack..."
  docker compose up -d --build

  log "Fuehre Prisma-Migrationen im Server-Container aus..."
  docker compose exec -T server sh -lc "cd server && npx prisma migrate deploy && npx prisma generate"

  ok "Deployment abgeschlossen"
  echo "App: http://localhost"
  echo "API: http://localhost/api/health"
}

do_rebuild_from_scratch() {
  log "Hole neuesten Stand von origin/$BRANCH..."
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"

  warn "Stoppe und entferne alle Compose-Container, Netzwerke und Volumes..."
  docker compose down --volumes --remove-orphans

  log "Baue den Docker-Stack komplett neu..."
  docker compose build --no-cache

  log "Starte den Docker-Stack frisch..."
  docker compose up -d --force-recreate

  log "Fuehre Prisma-Migrationen im frischen Server-Container aus..."
  docker compose exec -T server sh -lc "cd server && npx prisma migrate deploy && npx prisma generate"

  ok "Kompletter Neuaufbau abgeschlossen"
  echo "App: http://localhost"
  echo "API: http://localhost/api/health"
}

confirm_reset() {
  local confirm_one=""
  local confirm_two=""

  warn "Du bist dabei, ALLE Daten in der Datenbank zurueckzusetzen."
  warn "Das loescht Inhalte, Nutzerzustand und gespeicherte HQ-Daten unwiderruflich."
  read -r -p "Tippe RESET zum Fortfahren: " confirm_one
  [ "$confirm_one" = "RESET" ] || err "Abgebrochen."

  read -r -p "Tippe NOCHMAL RESET zum finalen Bestaetigen: " confirm_two
  [ "$confirm_two" = "RESET" ] || err "Abgebrochen."
}

do_update_with_reset() {
  confirm_reset
  do_rebuild_from_scratch
}

show_menu() {
  echo
  echo "Next Phantoms HQ Update-Menue"
  echo "1) Update"
  echo "2) Update mit komplettem Datenbank-Reset"
  echo "3) Abbrechen"
  echo
  read -r -p "Auswahl: " choice

  case "$choice" in
    1) do_update ;;
    2) do_update_with_reset ;;
    3) ok "Abgebrochen" ;;
    *) err "Ungueltige Auswahl" ;;
  esac
}

ensure_requirements

case "$MODE" in
  menu) show_menu ;;
  update) do_update ;;
  reset) do_update_with_reset ;;
  install) do_update ;;
  *) err "Unbekannter Modus: $MODE" ;;
esac
