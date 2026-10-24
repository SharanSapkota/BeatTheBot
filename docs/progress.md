# Progress

**Current step:** 3. `prediction_model` + `ai_predictions` (not started)
**Last updated:** 2026-10-24

| # | Step | Status |
|---|---|---|
| 0 | Monorepo setup, tooling, docker Postgres, `/health` | ✅ done |
| 1 | Database schema + Liiga API sync + demo fill-ins | ✅ done |
| 2 | Games API: today's games with state, game detail, standings | ✅ done |
| 3 | `prediction_model` + `ai_predictions` (pick, %, reasons, stakes) | ⬜ |
| 4 | Accounts (`users`, `auth_identities`, `sessions`, `POST /auth/device`) + before-game predictions + scoring + leaderboard (Humans vs AI vs Crowd) | ⬜ |
| 5 | `fact_checker` + LLM "what it means" story + traffic light | ⬜ |
| 6 | Questions: live picks (next goal, period goal), result quiz, player vote | ⬜ |
| 7 | Highlights: minimal editor form + editor approval for stories | ⬜ |
| 8 | PWA UI: 5 screens (matches docs/design), pulled forward | ✅ done |
| 9 | PWA features: manifest, icons, service worker, offline, update toast, install button, Lighthouse check | ⬜ |
| 10 | Embed on kaleva.fi: widget build + demo Chrome extension + account linking (Kaleva identity) | ⬜ |
| 11 | Reliability report (golden set + planted errors) | ⬜ |

Status: ⬜ todo · 🟨 in progress · ✅ done

LATER (not on the roadmap unless asked): daily games, email OTP, languages sv/en, private leagues, full admin app, web push, clip pipeline.

## Log
<!-- Newest first. One short entry per finished step: what was built, files, tests, open issues. -->

### 2026-10-24 · Step 8 (pulled forward): PWA UI, 5 screens ✅
- `apps/web`: hub, Before / During / After (picked from the game's state), Leaderboard; 390 px phone first, centered 430 px column on desktop. Tokens, fonts (@fontsource Barlow Condensed + Inter, self-hosted) and copy from `docs/design/`.
- Structure: `app/` (router, providers, shell), `styles/`, `components/` (shared UI, CSS Modules), `features/<screen>/` (api.ts hooks, copy.ts, components, page), `lib/` (api_client, format, storage, picks, points, demo_mode), `mocks/`.
- Real API first: game day, game detail, demo replay, team players. Sample data (each with a `TODO(step N)` comment) for AI prediction, win chance, highlight, story, quiz, fan poll, `/me`, leaderboard. Each hook calls the future endpoint and falls back on 404 `NOT_FOUND` (console warning once). New contracts in `packages/shared_types/src/game_extras.ts`.
- Picks in localStorage per game; lock-in until puck drop; points from a pure, tested `compute_game_points()` (design case: you 38, AI 25).
- Demo mode: `?demo=1` (or `VITE_DEMO_MODE=true`), moment in the URL (`?moment=before|live|final`), "Demo replay" badge.
- Tests: web 42 unit/component (Vitest + Testing Library); Playwright e2e 2 (installed Chrome, 390x844) with screenshots in `apps/web/e2e/screenshots/`; 3 design-check rounds.
- Known differences from the design: real replay data (Kärpät–KalPa 5–2, start times from the replay shift, real player names), no preselected picks, the "Demo replay" badge row, period-end rows in game events.
- Open: the empty `apps/api/.env` still makes `pnpm test` fail for the api (run from the repo root instead).

### 2026-10-24 · Step 2: Games API ✅
- `packages/shared_types/src/games.ts`: zod schemas + types for team_summary, game_summary, game_detail, game_event, standings_row, player_summary, game_day (+ response wrappers). API tests validate every response with them.
- Modules (routes → controller → service → repository): `teams` (`/teams`, `/teams/:id/players` with season goals + last-5 goals from real games), `games` (`/game_days/:date|today`, `/games`, `/games/:id` with running score and derived period ends), `standings` (`/standings`, goal difference + last-5 form), `demo` (`/demo/game_day`, `/demo/games/:id`, pure `replay_game()`).
- Migration `0006_game_live_state`: `games.period`, `games.game_clock_seconds`. Liiga client: `get_game()` (per-game call, has penalties).
- `jobs/live_sync.ts`: `LiveSyncJob` + `LiveSyncPoller` started in `server.ts`, stopped on shutdown; polls only when Liiga games are due (started ≤ 6 h ago, not final).
- Helsinki days with `date-fns-tz` (`common/helsinki_date.ts`); cache headers in `common/cache_control.ts` (live → no-store, else max-age 60 + ETag).
- Env: `FEATURED_TEAM_EXTERNAL_ID`, `LIVE_SYNC_ENABLED`, `LIVE_SYNC_INTERVAL_SECONDS`, `DEMO_REPLAY_ENABLED`.
- Tests: api 140 passing (unit with fakes, repository integration on the test DB from fixtures, Supertest controllers, live sync with fake timers); shared_types 7.
- Checked against real data (2026-10-24): 8 games today, Kärpät first; Kärpät 5-2 KalPa detail; standings with form; demo live = Kärpät 2-1 KalPa at P2 12:41.
- Open: no response cache for the Liiga client (fixture client covers offline). Live sync is untested against a real live game (no game was live during the check).

### 2026-10-24 · Step 1: schema, Liiga sync, demo fill-ins ✅
- Schema (migrations edited in place, nothing deployed yet): `data_source` on all sports tables; `position` = forward/defense/goalie (nullable); `teams.city` nullable; `users` without login data + new `auth_identities`; `login_codes` removed.
- `integrations/liiga_client/`: `LiigaClient` interface, `HttpLiigaClient` (x-api-key only when set, timeout, zod-validated, `AppError` on failure), `FixtureLiigaClient`, `liiga_mapper.ts` (pure), `create_liiga_client.ts`.
- `jobs/sync_games.ts` + `sync_games_repository.ts`: one transaction, upsert by `external_id`, events replaced per game, never touches demo rows. `pnpm --filter api sync:liiga [-- --fixtures]`.
- Seed: Liiga sync (fixture fallback) → `demo_<state>` games only for hub states missing today → 6 demo users with device identities + 5 picks. Old fake-season generator removed.
- Real sync (2026-10-24): 17 teams, 545 players, 544 games, 671 goal events; all 169 finals match their goal events. Today has 8 real games, so no demo games were needed.
- Tests: 64 passing in api (mapper, HTTP client, sync job, repository + seed integration on the test DB).
- Open: bulk games call has no penalty events (needs per-game call, step 2 live sync).

### 2026-10-24 · Scope + architecture update (docs only)
- MVP is now a PWA first (5 screens: hub, before, during, after, leaderboard); embed on kaleva.fi moves to step 10.
- Accounts redesigned for linking: `users` + `auth_identities` (`device` | `email` | `kaleva`) + `sessions`, Bearer-only auth, `POST /auth/device` for the MVP. Email OTP, daily games, languages, private leagues, full admin moved to LATER.
- Roadmap renumbered to steps 0–11. Updated: `CLAUDE.md`, `product.md`, `architecture.md`, `data_model.md`, `api.md`, `widget_and_extension.md`.

### 2026-10-24 · Step 0: monorepo setup ✅
- pnpm 12 workspaces (`apps/*`, `packages/*`), versions in the `catalog:`, Node 24 in `.nvmrc`.
- `packages/config`: shared tsconfig, ESLint flat config (typescript-eslint strict, naming rules, react-hooks), Prettier.
- `packages/shared_types` (`ApiSuccess`/`ApiError`, `health_response_schema`); placeholders for `prediction_model`, `fact_checker`, `i18n`.
- `infra/docker-compose.yml`: Postgres 16 + Mailpit.
- `apps/api`: Express 5, zod env, AppError + error/404/request-id middleware, pino, `container.ts`, `GET /api/v1/health`.
- `apps/web`: Vite + React, TanStack Query, react-router, `/` shows the API health status.
- Tests: 16 passing (api 9, web 1, packages 6). Lint, typecheck, format and build are clean.
- Notes: Node 24 instead of 20 (the latest vitest, tsup, react-router and jsdom need Node 22+; Node 20 is end-of-life). TypeScript 6.0, because typescript-eslint does not support 7 yet.

## Open questions
- Liiga API endpoints / auth / rate limits
- Player stats per game available?
- Can we use real clips?
- Sponsors, staging environment?
- Kaleva Media SSO (OIDC) details for account linking (step 10)?
