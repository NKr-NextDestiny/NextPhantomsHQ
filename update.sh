#!/usr/bin/env bash
set -euo pipefail

# ─── Next Phantoms HQ — Production Update Script ───
# Usage: ./update.sh [--force] [--no-backup] [--branch main]

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BRANCH="main"
FORCE=false
SKIP_BACKUP=false
BACKUP_DIR="$REPO_DIR/backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[UPDATE]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $1"; }
err()  { echo -e "${RED}[ERROR ]${NC} $1"; exit 1; }

# ─── Parse arguments ───
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)     FORCE=true; shift ;;
    --no-backup) SKIP_BACKUP=true; shift ;;
    --branch)    BRANCH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: ./update.sh [--force] [--no-backup] [--branch <branch>]"
      echo ""
      echo "  --force       Skip confirmation prompt"
      echo "  --no-backup   Skip database backup before update"
      echo "  --branch      Branch to pull (default: main)"
      exit 0
      ;;
    *) err "Unknown option: $1" ;;
  esac
done

cd "$REPO_DIR"

# ─── Pre-flight checks ───
command -v docker >/dev/null 2>&1        || err "docker not found"
command -v docker compose >/dev/null 2>&1 || err "docker compose not found"
command -v git >/dev/null 2>&1           || err "git not found"
[ -f ".env" ]                            || err ".env file missing"
[ -f "docker-compose.yml" ]              || err "docker-compose.yml missing"

# ─── Show current vs remote version ───
log "Fetching latest changes from origin/$BRANCH..."
git fetch origin "$BRANCH" --quiet

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/$BRANCH")
LOCAL_SHORT="${LOCAL_SHA:0:7}"
REMOTE_SHORT="${REMOTE_SHA:0:7}"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  ok "Already up to date ($LOCAL_SHORT)"
  if [ "$FORCE" = false ]; then
    exit 0
  fi
  warn "--force flag set, rebuilding anyway"
fi

COMMITS_BEHIND=$(git rev-list HEAD.."origin/$BRANCH" --count)
log "Current: $LOCAL_SHORT | Remote: $REMOTE_SHORT | $COMMITS_BEHIND commit(s) behind"
echo ""
git log --oneline HEAD.."origin/$BRANCH" | head -15
echo ""

# ─── Confirm ───
if [ "$FORCE" = false ]; then
  read -rp "Apply update? [y/N] " confirm
  [[ "$confirm" =~ ^[yYjJ]$ ]] || { log "Aborted."; exit 0; }
fi

# ─── Backup database ───
if [ "$SKIP_BACKUP" = false ]; then
  log "Backing up database..."
  mkdir -p "$BACKUP_DIR"

  # Read DB credentials from .env or use defaults
  DB_USER=$(grep -oP '^DB_USER=\K.*' .env 2>/dev/null || echo "phantoms")
  DB_NAME=$(grep -oP '^DB_NAME=\K.*' .env 2>/dev/null || echo "next_phantoms_hq")
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.sql.gz"

  # Check if postgres container is running
  if docker compose ps postgres --status running --quiet 2>/dev/null | grep -q .; then
    docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    ok "Database backup: $BACKUP_FILE ($BACKUP_SIZE)"
  else
    warn "Postgres container not running, skipping backup"
  fi

  # Keep only last 10 backups
  ls -t "$BACKUP_DIR"/db_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm --
  ok "Old backups cleaned (keeping last 10)"
fi

# ─── Pull latest code ───
log "Pulling origin/$BRANCH..."
git pull origin "$BRANCH" --ff-only || err "Pull failed — resolve conflicts manually"
NEW_SHA=$(git rev-parse --short HEAD)
ok "Now at $NEW_SHA"

# ─── Rebuild and restart containers ───
log "Rebuilding containers (this may take a few minutes)..."
docker compose build --no-cache

log "Stopping old containers..."
docker compose down

log "Starting updated containers..."
docker compose up -d

# ─── Wait for health checks ───
log "Waiting for services to become healthy..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if docker compose ps postgres --status running --quiet 2>/dev/null | grep -q .; then
    PG_HEALTH=$(docker compose ps postgres --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || echo "")
    if echo "$PG_HEALTH" | grep -qi "healthy"; then
      break
    fi
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  warn "Postgres health check timed out after ${TIMEOUT}s — check logs"
else
  ok "Postgres healthy"
fi

# Wait a bit for server + client to start
sleep 5

# ─── Verify services are running ───
RUNNING=$(docker compose ps --status running --quiet 2>/dev/null | wc -l)
EXPECTED=4  # postgres, server, client, nginx

if [ "$RUNNING" -ge "$EXPECTED" ]; then
  ok "All $EXPECTED services running"
else
  warn "Only $RUNNING/$EXPECTED services running — check with: docker compose ps"
  docker compose ps
fi

# ─── Quick smoke test ───
log "Running smoke test..."
API_OK=false
for i in $(seq 1 10); do
  if curl -sf http://localhost:4000/api/health >/dev/null 2>&1; then
    API_OK=true
    break
  fi
  sleep 2
done

if [ "$API_OK" = true ]; then
  ok "API responding on :4000"
else
  warn "API not responding yet — check: docker compose logs server"
fi

CLIENT_OK=false
for i in $(seq 1 10); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    CLIENT_OK=true
    break
  fi
  sleep 2
done

if [ "$CLIENT_OK" = true ]; then
  ok "Client responding on :3000"
else
  warn "Client not responding yet — check: docker compose logs client"
fi

# ─── Done ───
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Update complete!  $LOCAL_SHORT → $NEW_SHA${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Useful commands:"
echo "    docker compose ps          — service status"
echo "    docker compose logs -f     — live logs"
echo "    docker compose logs server — server logs"
echo "    docker compose down        — stop everything"
echo ""
