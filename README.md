# NEET 2026 Prep Platform

Production-quality NEET UG 2026 preparation web platform for a small private
group. Full spec lives in [`SPEC.md`](./SPEC.md) — that file is the source of
truth.

## Stack

React 18 + Vite + TypeScript + Tailwind (web) · Node + Express + TypeScript
(API) · PostgreSQL + Prisma (DB) · custom username/password auth (bcrypt +
JWT, httpOnly refresh cookie).

## Repo layout

```
/reference   → source PDFs you provide (SPEC §7) — required for Milestone 2+
/ingestion   → PDF parsing / PYQ extraction / syllabus seeding (Milestone 2)
/server      → Express API, Prisma schema, auth
/web         → React app
/agent       → NEET Content Agent — provider-agnostic AI engine (Milestone 3)
/scripts     → batch content pre-generation (Milestone 8)
```

## Run locally (dev)

Prereqs: Node ≥ 20, and Postgres 16 (either your own, or via Docker).

```bash
# 1. Start Postgres (pick one)
docker compose up -d db          # Docker
# …or point DATABASE_URL at any Postgres 16 instance

# 2. Configure
cp .env.example .env             # then edit JWT_SECRET (openssl rand -hex 32)

# 3. Install, migrate, seed
npm install
npm run db:migrate               # applies Prisma migrations
npm run db:seed                  # seeds the four subjects
npm run db:load-chapters --workspace server   # loads the 81-chapter syllabus
npm run db:load-questions --workspace server  # loads the verified PYQ bank

# 4. Run (API on :4000, web on :5173, /api proxied automatically)
npm run dev
```

Open http://localhost:5173, register a username + password, and you're in.

## Run the whole thing with Docker

```bash
cp .env.example .env             # set JWT_SECRET at minimum
docker compose up --build        # app on http://localhost:4000
```

The production image serves the built React app and the API from a single
process — one deployable unit (Railway / Render / Fly.io ready).

## Environment variables

See [`.env.example`](./.env.example). Secrets live in `.env` only — never
commit it, never paste keys into chat or logs. `AI_PROVIDER` / `AI_MODEL` /
`AI_API_KEY` are consumed by the content agent from Milestone 3 on.

## Milestone status

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Scaffold, design tokens, docker-compose, Prisma schema + migrations | ✅ done |
| M1 | Auth (register/login/refresh/logout, protected routes) | ✅ done |
| M2 | Ingestion: 81-chapter syllabus + weighting, verified PYQ bank | ✅ done |
| M3 | Content agent + validators + caching | ⏳ **needs `AI_API_KEY` in `.env`** |
| M4 | Question bank + diagram bank | pending |
| M5 | Exam engine | pending |
| M6 | Shortnotes / flowcharts / flashcards tabs | pending |
| M7 | Progress + rankboard | pending |
| M8 | Batch pre-generation + polish | pending |

> **Note on `/reference`:** the PDFs are large; if any exceed GitHub's 100 MB
> file limit, add them via [Git LFS](https://git-lfs.com/) or copy them into
> the folder locally without committing.
