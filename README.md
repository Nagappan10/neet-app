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

## Fill the bank to 45+ questions per chapter (AI generation)

The **Full NEET Mock** (180 questions, 45 per subject) and per-chapter practice
are best once every chapter has ~45 validated questions. With a Gemini key in
`.env` (`AI_PROVIDER="gemini"`, `AI_MODEL="gemini-2.0-flash"`, `AI_API_KEY="…"`),
run the batch generator:

```bash
# from /server — top every NTA-2026 chapter up to 45 validated questions
npm run generate:bank --workspace server

# useful flags:
npm run generate:bank --workspace server -- --target 45 --rpm 12 --batch 8
npm run generate:bank --workspace server -- --subject Physics      # one subject
npm run generate:bank --workspace server -- --max 200              # cap this run
```

It's **resumable** (re-run any time — it only tops up the gap), **rate-limited**
(survives free-tier limits; backs off on 429), and processes chapters by exam
weighting (most-tested first). Every question passes the same two-stage
validation as on-demand generation, so only verified questions enter the bank.

> **Free-tier note:** Gemini's free tier is rate-limited, so filling all 81
> chapters to 45 takes several runs across a day or two. Use `--max` to chunk it,
> or start with `--subject` / high-weight chapters. Each chapter's live count is
> shown on the Full NEET Mock card and in the Tests builder.

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
| M3 | Content agent (Gemini/Claude/OpenAI), validators, caching | ✅ done · add `AI_API_KEY` to use |
| M4 | Question bank browse + practice | ✅ done (diagram bank pending) |
| M5 | Exam engine: builder, Full NEET Mock, Web-Worker timer, scorecard | ✅ done |
| M8 | Batch pre-generation (`generate:bank`) to 45+/chapter | ✅ tool ready |
| M6 | Shortnotes / flowcharts / flashcards tabs | pending |
| M7 | Progress + rankboard | pending |
| M8 | Batch pre-generation + polish | pending |

> **Note on `/reference`:** the PDFs are large; if any exceed GitHub's 100 MB
> file limit, add them via [Git LFS](https://git-lfs.com/) or copy them into
> the folder locally without committing.
