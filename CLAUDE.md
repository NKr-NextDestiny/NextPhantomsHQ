# CLAUDE.md — NextPhantoms

## Project Overview

NextPhantoms is a single-team esports management platform for the NextPhantoms team (part of Next Destiny eSports). It provides training scheduling, scrim management, match tracking, strategy sharing, lineup building, opponent scouting, replay management, MOSS file storage, polls, and announcements — all with Discord-based authentication and AES-256-GCM file encryption.

## Architecture

### Monorepo Structure
- **`client/`** — Next.js 16 frontend (App Router, React 19, Tailwind CSS 4)
- **`server/`** — Express.js 5 backend (TypeScript, Prisma 7 ORM)
- **`shared/`** — Shared TypeScript types and constants

### Key Architectural Decisions
- **Single-team app** — no multi-team support, one team auto-created on first start
- **Discord-only auth** — OAuth 2.0 with guild/role restrictions via .env
- **Role-based via Discord** — ADMIN_ROLE_IDS and ALLOWED_ROLE_IDS in .env control access
- **No CMS, no bot** — pure team management functionality
- **AES-256-GCM encryption** — all uploaded files (strats, replays, MOSS) encrypted at rest
- **JWT auth** — httpOnly cookies, 7-day access + 30-day refresh tokens

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Zustand, Recharts
- **Backend:** Express.js 5, Prisma 7, Socket.io, Nodemailer
- **Database:** PostgreSQL 16+
- **Auth:** Discord OAuth 2.0 + JWT
- **Package manager:** pnpm with workspaces

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start client + server in dev mode
pnpm build            # Build everything

cd server
pnpm prisma migrate dev    # Run migrations
pnpm prisma generate       # Regenerate client
pnpm prisma studio         # DB GUI

docker compose up -d --build   # Full stack deployment
```

## Code Conventions

- TypeScript strict mode, no `any`
- Zod for all input validation
- Share types via `shared/` package
- Named exports (except Next.js pages)
- Route files: `server/src/routes/{feature}.routes.ts`
- Middleware: authenticate → teamContext → requireFeature → requireTeamRole
- API responses: `{ success: boolean, data?: T, error?: string }`

## Roles & Permissions

### Team Roles (ascending)
TRYOUT(-1) < PLAYER(0) < ANALYST(1) < COACH(2) < CAPTAIN(3) < ADMIN(4)

### Discord-based Access Control
- `REQUIRED_GUILD_ID` — must be member of this Discord server
- `ALLOWED_ROLE_IDS` — comma-separated, user needs ANY of these roles
- `ADMIN_ROLE_IDS` — comma-separated, these Discord roles grant app admin

### First User
- First user to log in automatically becomes admin

## Features (9 toggleable)
training, scrims, strats, matches, lineup, scouting, replays, announcements, polls

## Workflow
- Commit and push to `dev` after changes
- Commit messages in English, concise
