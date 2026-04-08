# Next Phantoms HQ

Team-Management-Plattform fuer Next Phantoms (Next Destiny eSports).
Training, Scrims, Matches, Strategien, Lineups, Scouting, Replays, MOSS, Polls, Wiki, Notizen, Erinnerungen, Verfuegbarkeit — alles mit Discord-Login und AES-256-GCM Verschluesselung.

---

## Produktiv-Installation auf Debian 13 (ohne SSL)

Komplette Anleitung von einem frischen Debian 13 Server bis zur laufenden App.

### 1. System vorbereiten

```bash
# Als root oder mit sudo
apt update && apt upgrade -y

# Grundlegende Pakete
apt install -y curl git wget gnupg2 ca-certificates lsb-release software-properties-common
```

### 2. Docker & Docker Compose installieren

```bash
# Docker GPG Key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Docker Repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Docker ohne sudo (optional, fuer deinen User)
usermod -aG docker $USER
# Danach neu einloggen oder: newgrp docker

# Pruefen
docker --version
docker compose version
```

### 3. Projekt klonen

```bash
# Zielverzeichnis (z.B. /opt oder /home/deinuser)
cd /opt
git clone https://github.com/Nexogenic-eSports/NextPhantomsHQ.git
cd NextPhantomsHQ
```

### 4. Environment konfigurieren

```bash
cp .env.example .env
nano .env
```

Folgende Werte MUESSEN angepasst werden:

```ini
# Sichere Passwoerter setzen!
DB_PASSWORD=ein-langes-sicheres-passwort-hier
DATABASE_URL=postgresql://phantoms:ein-langes-sicheres-passwort-hier@postgres:5432/next_phantoms_hq

# JWT Secret generieren (mindestens 64 Zeichen)
# Generieren: openssl rand -base64 48
JWT_SECRET=hier-langen-zufaelligen-string-eintragen

# Discord OAuth (https://discord.com/developers/applications)
DISCORD_CLIENT_ID=deine-client-id
DISCORD_CLIENT_SECRET=dein-client-secret
DISCORD_CALLBACK_URL=http://DEINE-SERVER-IP/api/auth/discord/callback

# Discord Server ID (Rechtsklick auf Server -> "Server-ID kopieren")
REQUIRED_GUILD_ID=deine-guild-id

# Optional: Rollen-IDs fuer Login-Berechtigung
ALLOWED_ROLE_IDS=
# Optional: Rollen-IDs die Admin-Zugang bekommen
ADMIN_ROLE_IDS=
# Optional: Discord User-IDs die immer Admin sind
ADMIN_USER_IDS=

# URLs auf deine Server-IP/Domain anpassen
APP_URL=http://DEINE-SERVER-IP
API_URL=http://DEINE-SERVER-IP
NEXT_PUBLIC_API_URL=http://DEINE-SERVER-IP

# File Encryption Key generieren (PFLICHT)
# Generieren: openssl rand -hex 32
FILE_ENCRYPTION_KEY=hier-64-zeichen-hex-string

# SMTP (optional, fuer E-Mail-Benachrichtigungen)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@deinedomain.de

# Discord Webhook (optional, fuer Benachrichtigungen im Channel)
DISCORD_WEBHOOK_URL=
```

### 5. Discord App einrichten

1. Gehe zu https://discord.com/developers/applications
2. "New Application" -> Name vergeben
3. Unter **OAuth2**:
   - Notiere **Client ID** und **Client Secret**
   - Unter "Redirects" diese URL eintragen:
     ```
     http://DEINE-SERVER-IP/api/auth/discord/callback
     ```
4. Trage Client ID und Secret in die `.env` ein

### 6. Uploads-Verzeichnis erstellen

```bash
mkdir -p uploads/general uploads/replays
chmod -R 777 uploads
```

### 7. App bauen und starten

```bash
docker compose up -d --build
```

Das startet:
- **postgres** — PostgreSQL 16 Datenbank
- **server** — Express.js API (Port 4000 intern)
- **client** — Next.js Frontend (Port 3000 intern)
- **nginx** — Reverse Proxy (Port 80 extern)

Der Server fuehrt beim Start automatisch `prisma migrate deploy` aus.

Erster Build dauert einige Minuten. Fortschritt pruefen:

```bash
docker compose logs -f
```

### 8. Pruefen ob alles laeuft

```bash
# Alle Container muessen "Up" sein
docker compose ps

# Health Check
curl http://localhost/api/health
# Erwartet: {"success":true,"data":{"status":"ok",...}}

# Frontend
curl -I http://localhost
# Erwartet: HTTP/1.1 200 OK
```

App ist jetzt erreichbar unter `http://DEINE-SERVER-IP`.

### 9. Erster Login

1. Oeffne `http://DEINE-SERVER-IP` im Browser
2. Klicke "Mit Discord anmelden"
3. Der erste User wird automatisch Admin
4. Weitere User koennen sich einloggen wenn sie im konfigurierten Discord-Server sind

---

## Discord IDs finden

Discord Entwicklermodus muss aktiviert sein:
**Einstellungen -> App-Einstellungen -> Erweitert -> Entwicklermodus AN**

| Was | Wo | .env Variable |
|---|---|---|
| Server ID | Rechtsklick auf Server-Name -> "Server-ID kopieren" | `REQUIRED_GUILD_ID` |
| Rollen ID | Server-Einstellungen -> Rollen -> Rechtsklick -> "Rollen-ID kopieren" | `ALLOWED_ROLE_IDS`, `ADMIN_ROLE_IDS` |
| User ID | Rechtsklick auf User -> "Benutzer-ID kopieren" | `ADMIN_USER_IDS` |

Mehrere IDs mit Komma trennen: `ADMIN_USER_IDS=123456789,987654321`

---

## Nuetzliche Befehle

```bash
# Logs anzeigen
docker compose logs -f
docker compose logs -f server    # nur Server
docker compose logs -f client    # nur Client
docker compose logs -f postgres  # nur DB

# Neustart
docker compose restart

# Stoppen
docker compose down

# Komplett neu bauen (nach Code-Updates)
docker compose down
docker compose up -d --build

# Datenbank-Shell
docker compose exec postgres psql -U phantoms -d next_phantoms_hq

# Prisma Studio (DB GUI, nur fuer Debugging)
docker compose exec server npx prisma studio

# Container Status
docker compose ps

# Speicherplatz pruefen
docker system df
```

## Updates einspielen

```bash
cd /opt/NextPhantomsHQ
git pull
docker compose down
docker compose up -d --build
```

Der Server fuehrt Datenbankmigrationen automatisch beim Start aus.

## Backup

```bash
# Datenbank-Dump erstellen
docker compose exec postgres pg_dump -U phantoms next_phantoms_hq > backup_$(date +%Y%m%d).sql

# Uploads sichern
tar czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Backup wiederherstellen
cat backup_20260408.sql | docker compose exec -T postgres psql -U phantoms next_phantoms_hq
```

## Firewall (UFW)

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw enable
```

## Troubleshooting

**Container startet nicht:**
```bash
docker compose logs server
# Meistens: DATABASE_URL falsch oder Postgres noch nicht bereit
# Loesung: docker compose restart server
```

**Discord Login leitet nicht weiter:**
- Pruefen: DISCORD_CALLBACK_URL in .env UND in Discord Developer Portal muessen identisch sein
- Format: `http://DEINE-SERVER-IP/api/auth/discord/callback`

**"Not in server" Fehler beim Login:**
- REQUIRED_GUILD_ID pruefen — ist die richtige Server-ID?
- Ist der User wirklich Mitglied des Discord-Servers?

**Datei-Upload schlaegt fehl:**
- `uploads/` Verzeichnis existiert? Rechte korrekt?
- `docker compose exec server ls -la /app/server/uploads/`

**Port 80 schon belegt:**
```bash
# Wer nutzt Port 80?
ss -tlnp | grep :80
# Anderen Dienst stoppen oder in docker-compose.yml Port aendern
```
