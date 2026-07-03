# MASTER BUILD PROMPT — "NEET 2026 Prep Platform"

> **How to use this with Claude Code:** Paste this whole document as your first message. Then say: *"Read this spec fully, ask me any blocking questions, propose a build order, and start with Milestone 0 (scaffold + auth + DB). Do not write placeholder/mock features — every module must actually work before moving on."* Work milestone by milestone. Keep this file in the repo as `SPEC.md` and update it as the source of truth.

---

## 0. MISSION & NON-NEGOTIABLES

Build a **production-quality NEET UG 2026 preparation web platform** for a small private group of users (me + a few friends). This is **NOT a prototype**. That means:

- **No placeholders, no lorem ipsum, no fake/mock data, no "TODO" stubs left in shipped features.** If a feature is in a milestone, it works end to end.
- Real authentication, real database persistence, real generated-and-validated content, a real working exam timer, real analytics.
- **Smooth and lag-free**: content is pre-generated and cached, not generated live on every view. Pages load instantly.
- Clean, maintainable, well-typed codebase that can be expanded chapter by chapter.

If any requirement here conflicts with reality (e.g. official 2026 exam pattern), **flag it and ask** rather than guessing.

---

## 1. TECH STACK (use exactly this unless you flag a strong reason)

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS. State: React Query (server state) + Zustand (local UI state). Routing: React Router.
- **Backend:** Node.js + Express + TypeScript. REST API.
- **Database:** PostgreSQL. Use Prisma as ORM (typed schema + migrations).
- **Auth:** Custom **username + password** (bcrypt hashing, JWT access/refresh tokens, httpOnly cookies). **No Google/Gmail/OAuth of any kind.**
- **Math rendering:** KaTeX. **Markdown:** a sanitized markdown renderer (react-markdown + rehype-sanitize).
- **Diagrams/flowcharts:** hand-built interactive **SVG with pan + zoom** (svg-pan-zoom or a custom wheel/drag handler). No heavyweight diagram libs.
- **Background timer:** Web Worker so the exam countdown never drifts or freezes when the tab is busy.
- **AI engine:** provider-agnostic module (see §4), default provider Anthropic (Claude). API keys via `.env` only.
- **Deployment target:** a single deployable full-stack app (Railway / Render / Fly.io). Provide a working `docker-compose` for local dev (app + Postgres) and clear README run steps.

Fonts: **Space Grotesk** (headings), **Inter** (body/UI), **JetBrains Mono** (numbers, timers, code, formulae labels).

---

## 2. HIGH-LEVEL ARCHITECTURE

```
/reference        → source PDFs (user provides; see §7)
/ingestion        → scripts: parse PDFs, extract PYQ questions, chunk, index, seed syllabus
/server           → Express API, Prisma schema, auth, content-agent service
/web              → React app (all tabs/modules)
/agent            → NEET Content Agent: prompt contracts, validators, provider adapters
/scripts          → batch generators (pre-generate shortnotes/flowcharts/flashcards/questions)
```

**Core principle — pre-generate + cache:**
- A batch job generates shortnotes, flowcharts, flashcards, and the question bank **once per chapter**, validates them, and stores them in Postgres.
- The app serves this stored content instantly.
- The live AI call is used **only** for on-demand custom requests (e.g. "make me a shortnote combining Thermodynamics + Chemical Kinetics right now"), and even those get cached after first generation.

---

## 3. DATA MODEL (Prisma) — minimum tables

- **User**: id, username (unique), passwordHash, displayName, createdAt.
- **Subject**: Physics, Chemistry, Botany, Zoology.
- **Chapter**: id, subjectId, className (11/12), title, ntaIncluded (bool), order, weighting (from PYQ analysis), topics (string[]).
- **Question**: id, chapterId(s) (allow 2+ for combined-topic questions), subjectId, stem (markdown+KaTeX), options (4), correctIndex, explanation, difficulty (easy/med/hard), type (mcq | assertion-reason | diagram | statement-match), isDiagram (bool), diagramSvg/diagramImageRef (nullable), source (pyq-year | ai-generated), validated (bool).
- **ContentAsset**: id, kind (shortnote | flowchart | flashcard-deck), chapterId(s), title, body (markdown / svg / json), language ("en"), generatedFrom (refs), version, createdAt. (Combined-topic assets allowed.)
- **Flashcard**: id, deckId, front, back, hint.
- **TestTemplate**: id, name, mode (full-mock | custom), config JSON (subjects, chapters, counts, difficulty mix, duration, marking).
- **TestAttempt**: id, userId, templateId, startedAt, submittedAt, durationSec, answers JSON (perQuestion: chosen, marked-for-review, time-spent), score, correct, wrong, unattempted, sectionBreakdown JSON.
- **LeaderboardEntry** (derived/materialized view): userId, testsCompleted, avgScore, bestScore, lastActive.

---

## 4. THE "NEET CONTENT AGENT" (AI ENGINE)

A dedicated service in `/agent`. Requirements:

**Provider abstraction:** one interface `generate(task, input) → structured output`, with adapters for **Anthropic (default), Gemini, OpenAI-compatible**. Model + key chosen entirely from `.env` (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`). Swapping providers must require **zero code changes**.

**Tasks it must support (each a strict, versioned prompt contract that returns validated JSON):**
1. `shortnote(chapter | [chapterA, chapterB])` — concept-first, exam-focused notes (see style rules below).
2. `flowchart(chapter | combined)` — returns a node/edge JSON that the frontend renders as an interactive SVG mind-map/flowchart (e.g. Krebs cycle, Calvin cycle, glycolysis, reaction pathways).
3. `flashcards(chapter | combined)` — deck of front/back/hint cards.
4. `questions(chapter(s), count, difficulty, type)` — generates MCQs **with correct answer + explanation**, tagged for the bank.
5. `diagram_question_patterns(pyqCorpus)` — extracts *how diagram questions are asked* from past papers, to seed the diagram-skills bank.
6. `translate_to_english(source)` — any Hindi source content is **fully translated to clean English** in the note itself; diagrams/labels preserved and relabeled in English. Output must contain **no Hindi**.

**Shortnote style rules (this is the quality bar — study the reference in §7):**
- Emulate the compact "key notes / definitions / formulae" density of the Arihant Physics Handbook, **but push further toward concept understanding**: each note leads with the *core idea in one line*, then the mechanism/why, then formulae (KaTeX), then common traps and PYQ-relevant points.
- Structured, skimmable, exam-oriented. No filler. English only. Include a short "NEET focus" callout per note listing what's actually tested.

**Validation (mandatory before anything is stored):**
- Every generated **question** must pass a validator: exactly 4 options, exactly one correct index, non-empty explanation, KaTeX compiles, and a **second-pass answer-key check** (re-ask the model to solve its own question independently; discard/flag on mismatch). Nothing enters the bank as `validated=true` without passing.
- Shortnotes/flowcharts/flashcards: schema-validate JSON, KaTeX compiles, language==English (reject if Hindi detected).

**Caching:** results keyed by (task + chapter set + params + prompt version). Serve cached; regenerate only on version bump or explicit "regenerate" action.

---

## 5. SYLLABUS = NTA 2026 (source of truth)

Do **not** hardcode the syllabus from memory. Build the chapter/topic matrix by parsing the project's **official NTA notice** and the **chapter-wise analysis PDFs** (§7). Mark chapters/topics removed for 2026 as `ntaIncluded=false` and hide them from generation and tests by default (with a toggle to show deprecated content). If the notice is ambiguous, surface a diff and ask me to confirm.

---

## 6. FEATURE MODULES

Each module below must ship fully working, with the listed acceptance criteria.

### 6.1 Auth
- Register/login with **username + password only**. bcrypt + JWT (httpOnly refresh cookie). Logout. Protected routes.
- No email required, no OAuth, no third-party sign-in.
- ✅ Done when: a friend can register a username/password, log in on another device, and see their own persisted data.

### 6.2 Question Bank (browse + practice)
- Browse/filter by subject → chapter → topic → difficulty → type.
- **Combined-topic support:** questions tagged to 2+ topics in a subject show up under a "combined" filter.
- **Diagram-skills bank:** a dedicated section of diagram questions (label / identify / interpret), seeded from PYQ diagram-question patterns (§4 task 5). Show the diagram, ask, reveal answer + explanation.
- Per-question: attempt, instant feedback, explanation, mark for revision.
- ✅ Done when: I can filter to "Physics · Thermodynamics + Kinetics · hard · diagram" and get real validated questions.

### 6.3 Exam / Test Engine (the flagship — like PW/online JEE, but NEET)
**Test builder (flexible):**
- Choose scope: single subject, multiple subjects, or **all 4 combined**.
- Choose **which chapters/lessons** and **how many** (1, 2, or as many as I want).
- Choose question count, difficulty mix, and duration.
- **Duration is fully user-selectable — this is a hard requirement.** For *every* test (custom or full mock) I can set **any countdown I want**: e.g. 20 min for a quick chapter drill, 45 min, 90 min, or a full-length sitting. Provide quick presets (e.g. 30/60/90/180/200 min) **and** a free "custom minutes" input. The timer is **never locked** to a fixed value.
- One-click **"Full NEET Mock"** preset: **720 marks** (180 questions × 4), marking **+4 / −1 / 0**. Its duration defaults to the official NTA 2026 timing (200 min / 3h20m — verify from the project notice) but that default **remains editable** like every other test.

**Test player:**
- **Countdown timer in a Web Worker** (survives tab throttling), visible, with auto-submit at 0.
- **Question navigation grid** (up to 180 cells) color-coded: not visited / attempted / marked-for-review / attempted+marked.
- Save-and-next, clear response, mark for review, jump via grid.
- **Submit button** with confirmation; also auto-submit on timeout.
- All progress persisted server-side so a refresh/disconnect doesn't lose the attempt.

**Post-test analytics:**
- Score, correct/wrong/unattempted, **section-wise (subject-wise) breakdown**, accuracy, time-per-question, weak chapters, and a review mode (see each question with your answer vs correct + explanation).
- ✅ Done when: I can run a full 180-Q mock with a live countdown, submit, and get an accurate NTA-style scorecard, and it's saved to my history.

### 6.4 Shortnotes tab
- Browse by subject/chapter; open a note that renders markdown + KaTeX beautifully.
- **On-demand generation** button ("generate / combine chapters") that calls the agent, then caches.
- English only; Hindi sources auto-translated. Style per §4.
- ✅ Done when: opening any seeded chapter shows an instant, high-quality concept note; and I can request a custom combined note on the spot.

### 6.5 Flowcharts / Mind-maps tab
- Interactive **SVG with pan + zoom**, node/edge layout, expandable nodes.
- Seeded for key processes (Krebs, Calvin, glycolysis, reaction pathways, etc.) + on-demand generation per chapter/combined.
- ✅ Done when: I can pan/zoom a real Krebs-cycle flowchart and generate a new one for any chapter.

### 6.6 Flashcards tab
- Deck per chapter; flip animation; "know / review again" tracking; spaced-repetition-lite ordering.
- On-demand deck generation.
- ✅ Done when: I can run a flashcard session and it remembers what I marked to review.

### 6.7 Progress + Rankboard
- Personal dashboard: tests completed, score trend, chapter mastery, weak areas.
- **Rankboard/leaderboard** across the friend group: tests completed, best/avg score, last active.
- **Tracker:** clicking a user's entry shows *what kinds of tests they've done* (full mocks, custom, subject-wise) and when.
- ✅ Done when: the leaderboard updates after a real submitted test and the tracker shows real attempt history.

---

## 7. REFERENCE & PYQ INGESTION

I will place **all** of these PDFs (from my project) into `/reference`. **Use every one of them — none are optional.** Each has a defined job so nothing is ignored:
- **Shortnote style + concept content:** `Arihant_Physics_Handbook.pdf` (physics), `ORGANIC_CHEMISTRY_DIGITAL_NOTES...pdf`, `PHYSICAL_CHEMISTRY_DIGITAL_NOTE...pdf`, `INORGANIC_CHEMISTRY_DIGITAL_NOTES...pdf` (chemistry), `NCERT_Tablet_Biology.pdf` (biology).
- **Question sources (feed the bank, validated):** `NCERT_2026_ALL_EXAMPLES.pdf` (turn worked examples into questions), `DPP_KHAN_SIR_ZOOLOGY...pdf` (zoology practice questions).
- **Diagram-skills bank:** `UNLABELLED_DIAGRAMSBIO_NCERT.pdf` (label/identify diagram questions) + diagram questions mined from PYQs.
- **Flashcards / quick-recall decks:** `BIOLOGY_VALUES_CHARTS.pdf` (values, ranges, key numbers).
- **Syllabus + chapter weighting:** `Notice_...pdf` (official NTA notice = syllabus source of truth), `PHYSICS_DETAILS_CHAPTER_WISE_ANALYSIS.pdf`, `CHEMISTRY_DETAILS_CHAPTER_WISE_ANALYSIS.pdf`, `BOTANY_DETAILS_CHAPTER_WISE_ANALYSIS_1.pdf`, `ZOOLOGY_DETAILS_CHAPTER_WISE_ANALYSIS.pdf`.
- **Past papers (PYQ bank + diagram patterns):** `neet_2016.pdf` … `neet_2025.pdf` (+ `neet_2025_1.pdf`) — all years.

Every file above must be ingested and its content actually reflected in the app; if any PDF fails to parse cleanly, flag it rather than silently skipping it.

Build an **ingestion pipeline** (`/ingestion`) that:
1. Extracts text (and images where needed) from each PDF.
2. **Parses PYQ papers into structured questions** (stem, options, answer key where available, chapter tag, isDiagram) → seeds the bank as `source=pyq-year`, `validated=true`.
3. Extracts **diagram-question patterns** for the diagram-skills bank.
4. Derives **chapter weighting** from the chapter-wise analysis files.
5. Chunks reference notes/NCERT for retrieval, so the agent **grounds generated content in NCERT + these notes** (retrieval can be simple keyword/section indexing at this scale; embeddings optional).
6. Any Hindi content is normalized to English at ingestion or generation time.

---

## 8. DESIGN SYSTEM (unique, elegant, neat, minimal — not a template)

Treat design as a **first-class system with tokens**, not decoration. The look should feel **precise and editorial**, not like a stock component kit.

- **Theme:** dark-first, minimal. Deep neutral base (not pure black), high-contrast ink, generous whitespace, hairline dividers, very soft depth. **One confident accent** used sparingly.
- **Starting tokens (tune for taste):** background `#0E1116` / surface `#151A21`, text `#E6EAF0` / muted `#8A94A6`, accent emerald `#34D399` with a secondary cerulean `#38BDF8` reserved for data/highlights only. Border hairline `#232A33`.
- **Type scale:** clear hierarchy; Space Grotesk for headings, Inter for body, JetBrains Mono for timers/scores/formulae labels. Comfortable line-height, restrained weights.
- **Motion:** subtle, purposeful micro-interactions (150–250ms), no bounce/gimmicks. Respect `prefers-reduced-motion`.
- **Layout:** calm grids, lots of breathing room, no clutter. Every screen should feel intentional and premium.
- Fully **responsive**; works well on laptop and phone.

---

## 9. PERFORMANCE

- Pre-generated content served from DB → instant tabs. No blocking AI calls on normal navigation.
- Pagination + lazy loading for large lists (question bank, past papers).
- Web-Worker exam timer; optimistic UI for answering.
- Code-split routes; cache API responses with React Query.
- Target: no visible lag on tab switches; smooth pan/zoom on flowcharts.

---

## 10. CONFIG & SECURITY

- All secrets in `.env` only (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`). Provide `.env.example`. **Never** log or echo the key. Never commit `.env`.
- Passwords bcrypt-hashed. Rate-limit auth. Sanitize all markdown/SVG before render.
- I will paste the API key **into `.env`, not into chat.**

---

## 11. BUILD ORDER (milestones — finish each fully before next)

- **M0 – Scaffold:** monorepo, Tailwind + design tokens, docker-compose (app+Postgres), Prisma schema + migrations, README.
- **M1 – Auth:** username/password, JWT, protected routes, session persistence.
- **M2 – Ingestion:** PDF parsing, syllabus matrix from NTA notice, PYQ → question bank, chapter weighting.
- **M3 – Content Agent:** provider-agnostic engine + validators + caching; generate & validate a first batch of shortnotes/flowcharts/flashcards/questions for 2–3 chapters as proof.
- **M4 – Question Bank + Diagram bank:** browse/filter, combined topics, practice, diagram-skills section.
- **M5 – Exam Engine:** builder (flexible selection + Full NEET Mock preset), Web-Worker timer, nav grid, submit/auto-submit, section-wise analytics, saved attempts.
- **M6 – Shortnotes / Flowcharts / Flashcards tabs** with on-demand generation.
- **M7 – Progress + Rankboard + tracker.**
- **M8 – Batch pre-generation** across all NTA-2026 chapters; polish, performance pass, responsive QA.

At the end of each milestone: run it, show it working (screenshots/steps), and list what's done vs pending.

---

## 12. DEFINITION OF DONE (anti-prototype checklist)

- [ ] Register/login works; data persists per user across devices.
- [ ] Question bank has real, validated questions (PYQ + AI), filterable incl. combined topics + diagram bank.
- [ ] Full 180-Q / 720-mark mock runs with a Web-Worker countdown, nav grid, submit + auto-submit, and an accurate NTA-style (+4/−1/0) scorecard saved to history.
- [ ] Custom test builder honors chosen subjects/chapters/counts/difficulty/duration.
- [ ] Shortnotes/flowcharts/flashcards are concept-quality, English-only (Hindi auto-translated), instant from cache, and generatable on demand.
- [ ] Flowcharts pan/zoom.
- [ ] Rankboard + per-user tracker reflect real attempts.
- [ ] Design matches §8 (minimal, elegant, tokenized) — not a stock template.
- [ ] No placeholders, no mock data, no dead buttons. `npm run dev` (or docker-compose) brings the whole thing up with clear instructions.

---

**First actions for Claude Code:** confirm you can read **all** the `/reference` PDFs (§7), propose the concrete repo scaffold, then begin **M0**. (Exam duration is fully user-selectable per §6.3 — nothing to confirm there.)
