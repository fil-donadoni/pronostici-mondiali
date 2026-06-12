# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js 16 + React 19.** APIs differ from older versions. Before writing framework code, read the relevant guide under `node_modules/next/dist/docs/`. Note: `headers()` is async (`await headers()`), route handlers receive a plain `Request`.

## What this is

Mondiali — personal prediction app for the FIFA Men's World Cup 2026 (48 teams). Each user fills in their own **Pronostici** (predictions) for every **Partita** (match) and compares them against real downloaded results. Single-user-centric: predictions are private, not in competition between users.

Domain glossary and the exact Italian terms to use (Pronostico, Partita, Girone, Classifica, Tabellone, Risultato reale, Sync, Differenza, Terza qualificata) live in **`CONTEXT.md`** — read it before touching domain code; match its vocabulary in code, comments, and UI.

## Commands

```bash
PORT=3100 npm run dev        # dev server (port pinned — see Local setup)
npm run build                # next build
npm run lint                 # eslint

npx drizzle-kit push --force # apply schema to DB (DDL) — uses DIRECT_URL
npm run db:seed              # seed teams + matches (tsx src/db/seed.ts)
npm run db:generate          # generate SQL migrations
npm run db:studio            # drizzle studio
```

There is **no test runner** configured.

### Local setup

- Postgres runs via Docker on host port **5433** (5432 is taken by a homebrew postgres → IPv6 conflict). `DATABASE_URL=postgres://mondiali:mondiali@localhost:5433/mondiali`.
- Dev server pinned to **3100**. `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the dev port or auth fails.
- First run: `npx drizzle-kit push --force` then `npm run db:seed`.
- Without `FOOTBALL_DATA_API_KEY`, seed uses 48 fallback nations and **Sync** generates deterministic demo results for the group matches. With the key it pulls real results from football-data.org.

## Architecture

### Core principle: persist only raw input, derive everything else (ADR 0001)

The DB stores **only** raw user input: `prediction` (one row per `user`×`match` with predicted scores + a knockout penalty-winner flag) and the static tournament seed (`team`, `match`). Group **Classifiche**, qualified teams, **Tabellone** slot filling, and winner propagation are **NOT tables** — they are recomputed in memory on every render, client-side. Do not add `standings`/`bracket` tables; their absence is deliberate. See `docs/adr/0001`.

`real_result` is the one cache table: real scores downloaded via Sync, shared across users.

### The derivation engine — `src/lib/tournament/`

All tournament logic is pure functions over the raw data, with no DB access:

- **`engine.ts`** — the heart. `computeStandings()` builds the 12 group tables from the user's predictions (3/1/0 points, tie-break in `compareRows`); `resolveBracket()` propagates predictions through the whole knockout (resolves each slot: group winner/runner-up, third-place via the official FIFA Annex C table in `third-place-table.ts`, winner-of/loser-of); `teamsReachingStage()` produces the set of teams predicted to reach each round.
- **`structure.ts`** — static knockout shape: `KNOCKOUT_MATCHES` (ordered so winner-of dependencies resolve in sequence), `GROUP_CODES`, stage order, `Slot` type.
- **`compare.ts`** — **Differenza** logic, two levels: `groupDiffs()`/`summarize()` compare predicted vs real scores on group matches directly; `roundSetDiffs()` compares the *sets* of teams reaching each knockout round (not the pairings — see CONTEXT.md / ADR notes).
- **`third-place-table.ts`** — FIFA's 495-combination third-place assignment table.
- Tie-break is **reduced** (points → goal diff → goals for → alphabetical id), not the full FIFA combinatorics; best-thirds is a **linear ranking** of the 12 thirds, not the real combinatorics (ADR 0002).

### Data flow

`src/app/page.tsx` (server component) gates on session, loads teams/matches/predictions/real-results via `src/lib/queries.ts`, and hands them to **`src/components/dashboard.tsx`** (the one big client component). Dashboard holds predictions + real results in React state and recomputes standings/bracket/reaching with `useMemo` on every change (per ADR 0001). It renders three tabs: `groups-tab`, `bracket-tab`, `compare-tab`.

Editing a prediction is optimistic: local state updates immediately, then a **600ms debounced** `PUT /api/predictions` per match. Sync is a manual button → `POST /api/sync`, then re-fetch `GET /api/real-results`.

### API routes — `src/app/api/`

Every route calls `auth.api.getSession({ headers: await headers() })` and 401s if absent. `PUT /api/predictions` upserts on (userId, matchId) with a zod-validated body. `POST /api/sync` downloads results (real from football-data.org by TLA team-code pair, or deterministic demo) into `real_result`. `GET /api/real-results` returns the shared cache. `api/auth/[...all]` is better-auth's catch-all.

### Auth & DB

- **better-auth** (`src/lib/auth.ts`) with the Drizzle adapter, email+password, no email verification (MVP), 7-day sessions. Client helpers in `src/lib/auth-client.ts` (`signIn`/`signUp`/`signOut`/`useSession`). Login/signup pages under `src/app/login` & `src/app/signup`.
- **Drizzle + postgres-js** (`src/db/index.ts`). The client auto-detects a Supabase/pgbouncer pooler from the connection string and disables `prepare` + `fetch_types` (named prepared statements + `fetch_types` deadlock concurrent `Promise.all` queries on pgbouncer) and forces TLS. Runtime uses the transaction pooler (6543); migrations use `DIRECT_URL` (session pooler / direct, 5432) via `drizzle.config.ts`.

### UI

shadcn (`src/components/ui/`, New York style per `components.json`), Tailwind v4, radix-ui, lucide icons, `sonner` toasts, `next-themes`. Path alias `@/*` → `src/*`. UI copy is in Italian.

## Conventions

- Keep derived state out of the DB (ADR 0001). New tournament logic → pure functions in `src/lib/tournament/`, tested by reading, not by a test suite.
- Use the domain terms from `CONTEXT.md`; avoid the listed synonyms.
- Record non-obvious design decisions as ADRs in `docs/adr/`.
