#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
info() { echo -e "${CYAN}[ INFO ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $1"; }

echo ""
echo -e "${RED}============================================${NC}"
echo -e "${RED}  Next Phantoms HQ — CLEAN${NC}"
echo -e "${RED}============================================${NC}"
echo ""
echo "  Was möchtest du löschen?"
echo ""
echo "  [1] Nur Daten (DB-Volumes, Uploads)"
echo "  [2] Alles (DB, Uploads, node_modules, Builds, Docker Images)"
echo "  [3] Abbrechen"
echo ""
read -rp "  Auswahl (1/2/3): " CHOICE

case "$CHOICE" in
  3) echo "Abgebrochen."; exit 0 ;;
  1) ;;
  2) ;;
  *) echo "Ungültige Auswahl."; exit 1 ;;
esac

# ─── Option 1: Nur Daten ───
if [ "$CHOICE" = "1" ]; then
  echo ""
  warn "Dies löscht die Datenbank und alle Uploads!"
  read -rp "  Bist du sicher? (y/n): " CONFIRM
  [[ "$CONFIRM" =~ ^[yYjJ]$ ]] || { echo "Abgebrochen."; exit 0; }
  echo ""

  if command -v docker >/dev/null 2>&1; then
    info "Stoppe Container und lösche Volumes..."
    docker compose down -v --remove-orphans 2>/dev/null || true
    ok "Datenbank-Volumes gelöscht"
  else
    info "Docker nicht verfügbar"
  fi

  if [ -d server/uploads ]; then
    rm -rf server/uploads
    ok "Uploads gelöscht"
  fi
  if [ -d uploads ]; then
    rm -rf uploads
    ok "Uploads gelöscht"
  fi

  echo ""
  echo -e "${GREEN}  Daten gelöscht. Starte mit: docker compose up -d --build${NC}"
  echo ""
  exit 0
fi

# ─── Option 2: Alles ───
echo ""
warn "Dies löscht ALLES:"
echo "  - Docker Container, Volumes und Images"
echo "  - Datenbank (PostgreSQL Daten)"
echo "  - node_modules (alle Pakete)"
echo "  - Build-Artefakte (.next, dist)"
echo "  - Generierte Prisma-Dateien"
echo "  - Upload-Dateien"
echo ""
read -rp "  Bist du sicher? (y/n): " CONFIRM
[[ "$CONFIRM" =~ ^[yYjJ]$ ]] || { echo "Abgebrochen."; exit 0; }

# 1. Docker
echo ""
info "=== Docker ==="
if command -v docker >/dev/null 2>&1; then
  docker compose down -v --remove-orphans 2>/dev/null || true
  ok "Container und Volumes gelöscht"

  IMAGES=$(docker images -q "nextphantomshq*" 2>/dev/null || true)
  if [ -n "$IMAGES" ]; then
    echo "$IMAGES" | xargs -r docker rmi -f 2>/dev/null || true
    ok "Docker Images entfernt"
  else
    info "Keine Project-Images gefunden"
  fi
else
  info "Docker nicht verfügbar, überspringe..."
fi

# 2. node_modules
echo ""
info "=== node_modules ==="
for dir in node_modules client/node_modules server/node_modules shared/node_modules; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    ok "$dir gelöscht"
  fi
done

# 3. Build-Artefakte
echo ""
info "=== Build-Artefakte ==="
for dir in client/.next server/dist shared/dist; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    ok "$dir gelöscht"
  fi
done

# 4. Generierte Dateien
echo ""
info "=== Generierte Dateien ==="
if [ -d server/src/generated ]; then
  rm -rf server/src/generated
  ok "Prisma generated client gelöscht"
fi

# 5. Uploads
echo ""
info "=== Uploads ==="
for dir in uploads server/uploads; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    ok "$dir gelöscht"
  fi
done

# 6. Lock-Datei
echo ""
info "=== Lock-Datei ==="
if [ -f pnpm-lock.yaml ]; then
  rm -f pnpm-lock.yaml
  ok "pnpm-lock.yaml gelöscht"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ALLES GELÖSCHT${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Neu starten: docker compose up -d --build"
echo ""
