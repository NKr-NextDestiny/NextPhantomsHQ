#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
info() { echo -e "${CYAN}[ INFO ]${NC} $1"; }
fail() { echo -e "${RED}[ FAIL ]${NC} $1"; }

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

# Load .env for DB credentials
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:-phantoms}"
DB_PASSWORD="${DB_PASSWORD:-changeme}"
DB_NAME="${DB_NAME:-next_phantoms_hq}"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Next Phantoms HQ — BACKUP${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# 1. Database backup
info "Erstelle Datenbank-Backup..."
if docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  ok "Datenbank-Backup erstellt: $BACKUP_FILE ($SIZE)"
else
  fail "Datenbank-Backup fehlgeschlagen"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# 2. Upload backup
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
if [ -d uploads ] || docker compose exec -T server ls /app/server/uploads >/dev/null 2>&1; then
  info "Erstelle Upload-Backup..."
  docker compose cp server:/app/server/uploads - 2>/dev/null | gzip > "$UPLOADS_BACKUP" && \
    ok "Upload-Backup erstellt: $UPLOADS_BACKUP" || \
    info "Upload-Backup uebersprungen (keine Dateien)"
fi

# 3. Cleanup old backups
info "Loesche Backups aelter als ${KEEP_DAYS} Tage..."
DELETED=$(find "$BACKUP_DIR" -name "*.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
ok "${DELETED} alte Backups geloescht"

# 4. Summary
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  BACKUP ABGESCHLOSSEN${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Backup-Verzeichnis: $BACKUP_DIR"
echo "  Aufbewahrung: $KEEP_DAYS Tage"
echo ""
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5
echo ""
