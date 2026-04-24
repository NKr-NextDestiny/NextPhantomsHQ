# Next Phantoms HQ

Next Phantoms HQ is a single-team management platform for Next Phantoms / Next Destiny eSports.

It includes:
- trainings, matches, strats, lineup, scouting
- replay and MOSS handling with AES-256-GCM encryption at rest
- Discord-only authentication
- email notifications
- WhatsApp notifications through Evolution API
- WhatsApp output modes for announcements, match results and poll results: `TEXT`, `IMAGE`, `BOTH`
- admin-managed group and private delivery rules
- automatic WhatsApp group description with custom text blocks
- admin tools for QR pairing, webhook setup and group ID lookup
- WhatsApp bot commands for quick group information

## Stack

- `client/`: Next.js 16, React 19, Tailwind CSS 4
- `server/`: Express 5, Prisma 7, Socket.io
- `shared/`: shared types/constants
- DB: PostgreSQL 16+
- Auth: Discord OAuth 2.0 + JWT cookies
- WhatsApp: Evolution API v2

## What Changed

This project now uses Evolution API as the WhatsApp provider.

WhatsApp delivery now runs through Evolution API and supports:
- plain text messages
- generated result cards for match and poll results
- image or image+text sending for announcements

The notification model is now:
- group messages for announcements, match results and poll results
- private reminders for training and match attendance
- email links are read-only after the first submitted answer
- private WhatsApp links can be changed for 5 minutes
- every outgoing email and WhatsApp message contains an automated-message notice

Only admins can change notification settings. Email can be enabled globally and additionally per player. WhatsApp is enabled globally and uses a group JID for public delivery, while private attendance reminders use the stored player phone number.

## WhatsApp Bot Commands

The WhatsApp bot currently supports:

- `!hilfe`
- `!befehle`
- `!naechstes`
- `!termine`
- `!umfragen`
- `!ankuendigungen`
- `!status`

Admins can send a ready-to-pin command overview directly into the WhatsApp group from the settings UI.

## Docker-First Operation

The project is now intended to run primarily through Docker Compose.

Windows development:

```bat
dev.bat
```

Debian install/update:

```bash
./update.sh install
```

Regular update afterwards:

```bash
./update.sh
```

## Local Development

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm build
pnpm test

cd server
pnpm prisma generate
pnpm prisma migrate dev
```

## Required Environment Variables

Copy the example file first:

```bash
cp .env.example .env
```

Minimum required values:

```ini
DATABASE_URL=postgresql://phantoms:password@postgres:5432/next_phantoms_hq
JWT_SECRET=generate-a-long-random-secret

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=http://YOUR-APP/api/auth/discord/callback
REQUIRED_GUILD_ID=

APP_URL=http://YOUR-APP
API_URL=http://YOUR-APP
NEXT_PUBLIC_API_URL=http://YOUR-APP

FILE_ENCRYPTION_KEY=64-char-hex-string
```

Optional but important:

```ini
ALLOWED_ROLE_IDS=
ADMIN_ROLE_IDS=
ADMIN_USER_IDS=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@nextphantoms.de

DISCORD_WEBHOOK_URL=

EVOLUTION_API_URL=http://EVOLUTION-VM:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_INSTANCE=nextphantoms
EVOLUTION_ATTENDANCE_INSTANCE=nextphantoms-private
```

## Production Install for Next Phantoms HQ on Debian 13

### 1. Prepare the server

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates gnupg2 lsb-release
```

### 2. Install Docker + Compose plugin

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Clone the project

```bash
cd /opt
git clone https://github.com/NKr-NextDestiny/NextPhantomsHQ.git
cd NextPhantomsHQ
```

### 4. Configure `.env`

```bash
cp .env.example .env
nano .env
```

Set at least:
- database credentials
- `JWT_SECRET`
- Discord OAuth values
- `REQUIRED_GUILD_ID`
- `APP_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`
- `FILE_ENCRYPTION_KEY`

If you want WhatsApp notifications, also set:
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE`
- optional: `EVOLUTION_ATTENDANCE_INSTANCE` for a separate private-message instance

### 5. Start the app

```bash
docker compose up -d --build
```

### 6. Check status

```bash
docker compose ps
docker compose logs -f
curl http://localhost/api/health
```

The stack starts:
- `postgres`
- `server`
- `client`
- `nginx`

### 7. First login

1. Open `http://YOUR-APP`
2. Sign in with Discord
3. Access is controlled by:
   - `REQUIRED_GUILD_ID`
   - `ALLOWED_ROLE_IDS`
   - `ADMIN_ROLE_IDS`
   - `ADMIN_USER_IDS`

### 8. Admin notification setup

Open `Settings -> Notifications` and configure:

1. global email on/off
2. global WhatsApp on/off
3. WhatsApp group JID
4. output mode for announcements
5. output mode for match results
6. output mode for poll results

In `Settings -> Members`, admins can additionally:

1. enable or disable email per player
2. maintain the player phone number used for private WhatsApp reminders

### 9. Admin WhatsApp setup

In `Settings -> Notifications`, admins can:

1. enable or disable WhatsApp globally
2. enter the WhatsApp group JID used for public team messages
3. choose whether announcements, match results and poll results are sent as `TEXT`, `IMAGE` or `BOTH`
4. post the bot command help text to the group
5. manage custom text blocks for the WhatsApp group description
6. preview and manually push the current group description

## Evolution API on a Separate Debian 13 VM

This is the recommended setup for WhatsApp delivery.

Evolution API v2 currently expects its own Redis and persistent database configuration. The official docs show Docker-based deployment with an API key and separate Postgres/Redis requirements, so this guide uses that layout.

Important: the old `atendai/...` image path should not be used anymore. For `evoapicloud/evolution-api`, `latest` can work, but a pinned version is still the safer and more reproducible choice for production.

### 1. Prepare the VM

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates gnupg2 lsb-release ufw
```

### 2. Install Docker + Compose plugin on the Evolution VM

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version
docker compose version
```

### 3. Create a working directory

```bash
mkdir -p /opt/evolution-api
cd /opt/evolution-api
```

### 4. Create `.env`

```bash
nano .env
```

Example:

```ini
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=http://YOUR-EVOLUTION-VM:8080

AUTHENTICATION_API_KEY=replace-with-a-random-secret

DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolutionpass@postgres:5432/evolution
DATABASE_CONNECTION_CLIENT_NAME=nextphantoms

DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

WEBSOCKET_ENABLED=false
TELEMETRY=false
```

### 5. Create `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evolutionpass
      POSTGRES_DB: evolution
    volumes:
      - evolution_postgres:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - evolution_redis:/data

  evolution-api:
    image: evoapicloud/evolution-api:v2.3.7
    container_name: evolution_api
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      - postgres
      - redis

volumes:
  evolution_postgres:
  evolution_redis:
  evolution_instances:
```

If a newer stable Evolution API release exists when you set this up, replace `v2.3.7` with that exact version tag. If you prefer, `evoapicloud/evolution-api:latest` can also be used, but a pinned version is recommended so your deployment stays reproducible.

### 6. Start Evolution API

```bash
docker compose up -d
docker compose logs -f evolution-api
```

### 7. Firewall

If the app server talks to Evolution directly, only open port `8080` from the app server IP if possible.

Example with UFW:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow from APP_SERVER_IP to any port 8080 proto tcp
ufw enable
```

### 8. Open the Evolution Manager

After the API is running, open:

- `http://YOUR-EVOLUTION-VM:8080/manager`

If the root URL only shows the API status JSON, that is normal. The web UI is under `/manager`, not `/`.

### 9. Log in to the Manager

The Manager asks for the global API key.

Use the value from:

- `AUTHENTICATION_API_KEY`

from the Evolution API `.env` on the VM.

This is the key for the Manager login and for the app integration.

### 10. Create the WhatsApp instances in the Manager

Create your WhatsApp instance directly in the Evolution Manager UI.

Recommended:

- main instance for group messages, for example `nextphantoms`
- optional second instance for private attendance reminders, for example `nextphantoms-private`

For each instance:

1. choose `Baileys` as the channel
2. keep the generated token or let the Manager create one
3. enter the WhatsApp number in international format without `+`, for example `491701234567`
4. save the instance
5. connect WhatsApp by scanning the QR code shown in the Manager

Do not do any of these steps in Next Phantoms HQ. Instance creation, QR pairing and group lookup are handled in the Manager.

Use the same instance names in the app:

```ini
EVOLUTION_INSTANCE=nextphantoms
EVOLUTION_ATTENDANCE_INSTANCE=nextphantoms-private
```

These values are the exact instance names from the Evolution Manager, not phone numbers and not group IDs.
If you only want to run a single instance, you can leave `EVOLUTION_ATTENDANCE_INSTANCE` empty and the app will fall back to `EVOLUTION_INSTANCE` for private reminder messages.

### 11. Set the webhook in the Manager

Still inside the Evolution Manager, configure the webhook for the main instance and the optional private instance.

Use:

- URL: `https://YOUR-APP/evolution/webhook`
- by events: enabled
- base64: enabled
- event: `MESSAGES_UPSERT`

The app only needs incoming message events for the WhatsApp command handling and attendance reply flow.

### 12. Find the correct WhatsApp group ID in the Manager

Use the Evolution Manager to list your groups and copy the correct WhatsApp group JID.

It looks similar to:

```text
1234567890-123456789@g.us
```

You will enter this value later in Next Phantoms HQ.

### 13. Connect the app to Evolution

In the Next Phantoms HQ `.env`:

```ini
EVOLUTION_API_URL=http://YOUR-EVOLUTION-VM:8080
EVOLUTION_API_KEY=YOUR_API_KEY
EVOLUTION_INSTANCE=nextphantoms
EVOLUTION_ATTENDANCE_INSTANCE=nextphantoms-private
```

Restart the app stack afterwards:

```bash
cd /opt/NextPhantomsHQ
docker compose down
docker compose up -d --build
```

### 14. Finish the WhatsApp setup inside Next Phantoms HQ

After the app is connected to Evolution:

1. open `Settings -> Notifications`
2. enable WhatsApp globally if desired
3. paste the WhatsApp group JID copied from the Manager
4. choose the output mode for announcements, match results and poll results
5. save the settings

In `Settings -> Members`, admins can then maintain player phone numbers and per-player email opt-in for the private reminder flow.

## In-App Notification Settings

After Evolution is connected:

1. Go to `Settings -> Notifications`
2. Enable or disable email globally
3. Enable or disable WhatsApp globally
4. Set the WhatsApp group JID copied from the Evolution Manager
5. Choose output mode for:
   - announcements
   - match results
   - poll results

Modes:
- `TEXT`: plain text only
- `IMAGE`: card/image only
- `BOTH`: image with accompanying text

Member-specific controls are managed in `Settings -> Members`.

## Attendance Link Behavior

- Email reminder links:
  - one submission only
  - if the player already voted, the page only shows the existing response
  - no change is possible through the email link
- Private WhatsApp reminder links:
  - can be updated while the 5-minute token window is valid
  - players can include a reason, for example why they cannot attend

If a player has already responded and later receives another email reminder, the email now directly states that a vote already exists instead of presenting a second change path.

## WhatsApp Group Description

The app can automatically maintain the WhatsApp group description.

It includes:

- the next upcoming training or match
- event notes when available
- attendance summary including reasons
- open polls
- the following upcoming events
- admin-managed custom blocks above and below the generated section

The admin UI also shows a live preview and character count before pushing the description to WhatsApp.

## Evolution Admin Access

You can fetch group IDs and connect WhatsApp in two ways:

1. in the app under `Settings -> Notifications`
2. directly on the server with:

```bash
cd /opt/NextPhantomsHQ/server
pnpm evolution:groups
```

Optional with explicit instance name:

```bash
cd /opt/NextPhantomsHQ/server
pnpm evolution:groups -- my-other-instance
```

## Replay Parsing Notes

Rainbow Six replay parsing is best-effort and works against real `.rec` files.

The parser now:
- extracts player names from replay headers more reliably
- scans all zstd-compressed frames instead of only the last one
- resolves partial in-frame names against known round players

It still depends on Ubisoft replay internals, so future game updates can require parser adjustments.

## Database Normalization Notes

The notification-related data is separated by responsibility:

- team-wide switches and group delivery settings live on `Team`
- per-user email preference and phone number live on `User`
- membership-specific role/status lives on `TeamMember`
- actual attendance decisions live on `TrainingVote` and `MatchVote`
- short-lived reminder-link state lives on `AttendanceToken`

That keeps the schema close to normal relational design and avoids duplicating vote state inside configuration records.

## Deploying DB Migrations

If you deploy manually outside the app container, run:

```bash
cd /opt/NextPhantomsHQ/server
pnpm prisma migrate deploy
pnpm prisma generate
```

The Docker setup already runs `prisma migrate deploy` during startup.

## Useful Commands

```bash
docker compose logs -f
docker compose logs -f server
docker compose logs -f client
docker compose logs -f postgres

docker compose ps
docker compose restart
docker compose down
docker compose up -d --build

cd server
pnpm evolution:groups
```

## Last Reviewed

Last reviewed: 2026-04-23
