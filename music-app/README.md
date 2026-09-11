# Music Mini App — Telegram Mini App + Bot

A Telegram-native music platform: users log in with their Telegram account,
upload tracks/beats, listen inside a Mini App, like/save/follow, build
playlists, and see charts and trending tracks. Includes a linked Telegram
bot and an admin panel.

This is an **MVP** built to the priority list: Telegram auth, Home, Search,
Upload, music player, tracks, profiles, likes, favorites, playlists, plays
counting, charts, beats, follow, Telegram bot, admin panel. Recommendations,
"Radio", comments, and a beat marketplace with real payments are stubbed at
the architecture level (DB tables and/or basic endpoints exist) but not
fully built out — see "What's left" below.

## Stack

- **Frontend:** React + TypeScript + Vite, Telegram WebApp SDK, plain CSS
- **Backend:** Node.js + TypeScript + Fastify + Prisma + PostgreSQL
- **Storage:** any S3-compatible object storage (MinIO included for local/self-hosted use)
- **Bot:** grammY (Telegram Bot framework)
- **Orchestration:** Docker Compose

## Project structure

```
/backend    Fastify API + Prisma schema + migrations + seed script
/bot        Telegram bot (long polling), linked to the Mini App via WebApp buttons
/frontend   React Mini App (Vite)
docker-compose.yml
.env.example
```

## 1. Prerequisites

- Docker + Docker Compose (easiest path), OR Node.js 20+ and a local PostgreSQL if you want to run services without Docker
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- For production: an HTTPS domain (Telegram requires HTTPS for Mini Apps). For local testing, use a tunnel like `ngrok http 5173` or `cloudflared tunnel --url http://localhost:5173`.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in at minimum:
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `MINI_APP_URL` — your HTTPS frontend URL (or tunnel URL while testing)
- `JWT_SECRET` — any long random string
- `ADMIN_TELEGRAM_IDS` — your own numeric Telegram ID (get it from [@userinfobot](https://t.me/userinfobot)) so your account is auto-promoted to admin on first login

## 3. Run everything with Docker Compose

```bash
docker compose up --build
```

This starts PostgreSQL, MinIO (S3-compatible storage, auto-creates the
`music-app` bucket), the backend API on `:4000`, the bot (long polling), and
the frontend on `:5173`.

Run migrations and seed demo data (first time only):

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

Open `http://localhost:5173` through your HTTPS tunnel from inside Telegram
(set that tunnel URL as your bot's Mini App URL in BotFather → `/mybots` →
your bot → **Bot Settings → Menu Button**, or via `/newapp`), then message
your bot and tap **Open Music App**.

## 4. Running without Docker (local dev)

```bash
# Terminal 1 — database (still easiest via Docker)
docker compose up postgres minio minio-init

# Terminal 2 — backend
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev

# Terminal 3 — bot
cd bot
npm install
npm run dev

# Terminal 4 — frontend
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173`. Outside Telegram,
`window.Telegram.WebApp.initData` won't exist — the backend will reject a
missing/invalid signature by design (see `backend/src/auth/telegramAuth.ts`),
so for UI-only work without a real Telegram session you'll need to either
open the dev server through Telegram's Mini App preview, or temporarily
stub the auth check while you work on layout.

## 5. Connecting the bot to the Mini App

In BotFather:
1. `/mybots` → select your bot → **Bot Settings → Menu Button** → set it to your HTTPS frontend URL, OR
2. `/newapp` to register a dedicated Mini App tied to the bot

The bot (`bot/src/index.ts`) also sends inline `WebApp` buttons on `/start`
and supports deep links: `https://t.me/your_bot?start=track_<id>`,
`profile_<nickname>`, `playlist_<id>`, `album_<id>`, `beat_<id>` — these open
the Mini App directly to that resource.

## 6. Demo data

`backend/prisma/seed.ts` creates demo users, tracks, and beats so the app
isn't empty on first run. The seeded tracks point at a placeholder audio URL
that doesn't actually resolve to a real file — **replace it** by uploading
real (your own / licensed / placeholder) audio through the app's Upload
screen, or edit the seed script to point at real files you've put in MinIO.
No third-party commercial music is bundled, by design.

## 7. Key environment variables reference

See `.env.example` for the full list with comments. The most important ones:

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Used both by the bot and by the backend to validate `initData` |
| `MINI_APP_URL` | Where the bot's buttons point |
| `JWT_SECRET` | Signs session tokens issued after Telegram login |
| `ADMIN_TELEGRAM_IDS` | Telegram numeric IDs auto-promoted to admin |
| `S3_*` | Object storage for audio/cover uploads |

## 8. Production deployment checklist

- [ ] Point `MINI_APP_URL` and the frontend's `VITE_API_BASE_URL` at real HTTPS domains (self-signed/`localhost` will not work inside Telegram)
- [ ] Swap MinIO for a managed S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, etc.) and put a CDN in front of it for `S3_PUBLIC_BASE_URL`
- [ ] Put the backend behind a reverse proxy with TLS (Caddy/Nginx/Traefik) and rate limiting at the edge
- [ ] Set a strong random `JWT_SECRET` and keep `.env` out of version control
- [ ] Schedule `backend/src/scripts/resetCounters.ts` via cron/k8s CronJob (daily/weekly/monthly/yearly — see comments in that file) to roll over the `playsToday/Week/Month/Year` counters
- [ ] Take regular PostgreSQL backups (the object storage bucket should also be backed up or versioned)
- [ ] Review `backend/src/config.ts` upload size/MIME limits for your expected content
- [ ] Consider moving the bot from long polling to a webhook for production scale

## 9. What's left beyond this MVP

These are intentionally deferred per the MVP-first priority, with the
groundwork already in place:

- **Recommendations** — `services/trending.ts` and `listening_history` /
  `follows` tables give you what you need to build a real recommendation
  query; currently new users just see trending/popular tracks.
- **"Radio"** — `GET /tracks/:id/similar` exists as a naive same-genre seed;
  swap in a smarter similarity signal (audio features, collaborative
  filtering) when you're ready.
- **Comments** — the `Comment` table and relations exist in the Prisma
  schema; no API routes or UI yet.
- **Notifications** — the `Notification` table exists; wire it up to the
  bot (`sendMessage`) for new-release/follow/like events.
- **Beat marketplace payments** — `Beat.licenseType` / `priceCents` exist;
  no payment processing (e.g. Telegram Stars, a card processor) is wired in.
- **Real Postgres full-text search** — `search.ts` currently uses
  `ILIKE`-style `contains` matching, which is fine at small catalog sizes;
  upgrade to `tsvector` + GIN indexes as the catalog grows.
- **Waveform generation** — the DB has a `waveformUrl` field but nothing
  currently generates one on upload.

## 10. A note on testing

This code was written and reviewed manually in an environment without
internet/network access, so `npm install` and a live build were **not**
run here. Before deploying, run through steps 3–4 above locally, fix any
dependency-version drift (`npm install` will surface it immediately), and
smoke-test: login → upload a track → play it past 30 seconds → confirm the
play count increments → check it appears in charts/trending.
