# Progress

**Current step:** 6. Questions ✅ done · step 5 code is in place but not logged or reviewed yet (🟨) · next: finish/log 5, then 7. Highlights
**Last updated:** 2026-10-24

| # | Step | Status |
|---|---|---|
| 0 | Monorepo setup, tooling, docker Postgres, `/health` | ✅ done |
| 1 | Database schema + Liiga API sync + demo fill-ins | ✅ done |
| 2 | Games API: today's games with state, game detail, standings | ✅ done |
| 3 | `prediction_model` + `ai_predictions` (pick, %, reasons, stakes) | ✅ done |
| 4 | Accounts (`users`, `auth_identities`, `sessions`, `POST /auth/device`) + before-game predictions + scoring + leaderboard (Humans vs AI vs Crowd) | ✅ done |
| 5 | `fact_checker` + LLM "what it means" story + traffic light | 🟨 |
| 6 | Questions: live picks (next goal, period goal), result quiz, player vote | ✅ done |
| 7 | Highlights: minimal editor form + editor approval for stories | ⬜ |
| 8 | PWA UI: 5 screens (matches docs/design), pulled forward | ✅ done |
| 9 | PWA features: manifest, icons, service worker, offline, update toast, install button, Lighthouse check | ⬜ |
| 10 | Embed on kaleva.fi: widget build + demo Chrome extension + account linking (Kaleva identity) | ⬜ |
| 11 | Reliability report (golden set + planted errors) | ⬜ |

Status: ⬜ todo · 🟨 in progress · ✅ done

LATER (not on the roadmap unless asked): daily games, email OTP, languages sv/en, private leagues, full admin app, web push, clip pipeline.

## Log
<!-- Newest first. One short entry per finished step: what was built, files, tests, open issues. -->

### 2026-10-24 · Step 6: questions (live picks, result quiz, player vote) ✅
- `packages/scoring/src/questions.ts` (pure): `QUESTION_POINTS` (next goal 5, period goal 3, quiz 2, vote 1, poll 0), `decide_next_goal`, `decide_period_goal`, `score_answer`. The web app's `lib/points.ts` now uses the same rules.
- Migration `0009_questions`: `questions.question_key` (unique per game), `target`, `explanation`. The `questions` / `user_answers` tables come from `0004`.
- API `modules/questions`: pure `question_drafts.ts` (live drafts: next goal per goal count with a 2-minute window, goal in the 3rd period, fan poll; after drafts: quiz + player vote; lock rules; player options = scorers, then season scorers) and `result_quiz.ts` (up to 3 questions from the fact sheet: first scorer, biggest season-odds change, table place, final score; plausible wrong options; deterministic order). Every shown quiz text passes `check_claims`, otherwise `in_review`. Service, repository, controller, routes: `GET /games/:id/questions?phase=live|after`, `POST /questions/:id/answers` (409 `QUESTION_LOCKED` / `ALREADY_ANSWERED`, 400 `INVALID_ANSWER`), `GET /demo/games/:id/questions?phase&moment` (in memory, never saved).
- `jobs/score_answers.ts` (+ repository): decides live picks and fills `points_awarded`; idempotent. Runs on API start, after every live sync update (new `update_triggers` in `LiveSyncJob`), when a game ends and after `sync:liiga`. The leaderboard (`list_answer_points`, which counts for points but not for winner accuracy) and `GET /me` points include answers.
- Shared: `packages/shared_types/src/questions.ts`; the old sample `result_quiz` / `fan_poll` shapes were removed from `game_extras.ts`.
- Web: `features/game/questions_api.ts` (`useQuestions`, `useAnswerQuestion`; first answer asks for a name, "Save and answer"), saved answers copied into the device picks (`with_answer`, `answer_of`, new `poll_answer`). During: next goal (server window and lock, one answer), period goal, fan poll (vote, then fans' shares). After: quiz (feedback once the API returns the right answer), player vote. Demo replays use the demo endpoint and keep answers on the device. Sample quiz, poll and vote mocks removed.
- Checked on real data: Kärpät–KalPa got 3 quiz questions from the step 5 fact sheet (first scorer, KalPa playoff odds 44% vs 61% / 54% / 34%, Kärpät 5th) and a vote with real players.
- Tests: scoring 17, api 280, web 65, e2e 5 (+1 skipped by design).
- Open: next-goal window is 2 minutes wall time (the product says game time); question texts are English only (like the stories); vote shares are not shown in the UI yet; the dev DB now holds the questions created during the check.

### 2026-10-24 · Tooling: quiet test output + "Voita Kaleva" rename ✅
- `scripts/quiet_run.sh <name> <cmd>`: full output to `.cache/test_logs/<name>.log` (gitignored), terminal shows only the summary, or the first failure plus the log's last lines. Root scripts `test:quiet` (vitest `--reporter=dot --silent=passed-only` in every package, `--no-bail`), `e2e:quiet` (Playwright `--reporter=line`), `lint:quiet`, `typecheck:quiet`.
- API tests log nothing: `vitest.config.ts` sets `LOG_LEVEL=silent` unless `LOG_LEVEL` is set in the shell; the e2e API runs with `LOG_LEVEL=warn`.
- Rename: localStorage prefix `voita_kone_` → `voita_kaleva_` (session `voita_kaleva_session`). Old keys are moved once on first access, so signed-in users stay signed in and keep their picks (`lib/storage.ts`, test). Page title "Voita Kaleva", header "VOITA KALEVA". Package names (`@voita_kone/*`), DB names and `CLAUDE.md` still say voita_kone (not shown to users).

### 2026-10-24 · Step 4: accounts, picks, scoring, leaderboard ✅
- `packages/scoring` (new, pure): `GameResult`, `winner_team_id`, `score_after_regulation`, `has_scored`, `score_pre_game` (10 / 25 / 15 / +5 beat the AI), `score_ai_pick`, `POINTS`. Used by the API and the web app (`lib/points.ts` keeps only the live/after parts until step 6).
- API: `modules/auth` (device sign-in, Bearer middleware on every route, `auth_context` via WeakMap, `require_auth` / `require_role`, logout), `common/rate_limit.ts` (20 sign-ins / IP / hour, in memory), `modules/users` (`GET/PATCH/DELETE /me`, GDPR delete by cascade), `modules/predictions` (`POST/PUT /games/:id/predictions`, `GET /me/predictions`), `modules/leaderboard` (pure `build_leaderboard`: ranks with the AI as a player, accuracy, last-5-weeks comparison, movement). `jobs/score_predictions.ts` (+ repository) fills `points_awarded`; `jobs/job_scheduler.ts` (generic, was `ModelRunScheduler`) runs model and scoring in the background; live sync triggers both on a final; `sync:liiga` and `db:seed` score too.
- Shared: `accounts.ts`, `predictions.ts`, `leaderboard.ts` (moved out of `game_extras.ts`; accuracy values nullable).
- Web: `lib/session.ts` (token in `voita_kone_session`), `api_request` with Bearer + 401 → forget token and retry GET once, `features/account` (sign-in, `useUserSummary`, `NameDialog`), Before: `useLockIn` (name dialog on first lock-in, POST then PUT, saved pick loaded back as locked, error messages; demo replays stay on the device). Header points and leaderboard use the API (sample data removed); "–" when an accuracy is unknown.
- Tests: scoring 9, api 217, web 56; e2e 5 (+ real sign-in and saved pick on both layouts; the test deletes its user again).
- Open: the prize text is a placeholder (no sponsor yet); `GET /me/history` postponed; this week no finished game has an AI pick (the model predicts from today on), so the AI shows "–"; the rate limit is per API process.

### 2026-10-24 · Kaleva theme + desktop layout (web only) ✅
- Theme: `styles/tokens.css` now holds the Kaleva tokens from `docs/design/README.md` (ink/dark/gray, orange `--color_brand` with dark text, `--color_brand_text` for orange text on white, tag, AI blue, fans gray). All old navy/Inter values removed; SVG charts and team marks use tokens too. Fonts: @fontsource Barlow Condensed 700/800 + Barlow Semi Condensed 300–700 (Inter removed from the catalog). `index.html`, `CLAUDE.md` and `architecture.md` theme color → `#111111` / `#F3F3F3`.
- Contrast checked for every text/background token pair (≥ 4.5:1). `--color_label` is `#6B6B6B` instead of Kaleva's `#767676`, which is only 4.1:1 on the gray page.
- New shared components: `kaleva_section_title` (uppercase title + orange bar, optional meta line; `mobile_variant="card"` = plain card title on mobile, Kaleva title from 900 px), `category_tag`, `page_grid` (`PageGrid` main + sidebar, `GridItem mobile_order` so one DOM gives the mobile card order and the desktop columns), `use_main_nav`.
- Layout: one breakpoint at 900 px, CSS only (media queries, global `mobile_only` / `desktop_only`). Below it the mobile layout is unchanged. From 900 px: white page, 1320 px content, `AppHeader` becomes the Kaleva header (wordmark, GAMES/LEADERS with a 4 px orange underline, points pill) on every page, and the bottom nav is hidden. Hub: BEAT THE AI + intro + demo pills, featured hero (dark panel + gray caption box with the biggest stake from the model), sidebar TODAY'S GAMES list (thumbnails) + THIS WEEK. Game screens: dark header band; Before = AI pick + stakes | YOUR PICKS; During = chart + events | LIVE PICKS + fan poll; After = highlight + story + timeline | result + points + quiz + vote; Leaderboard = ranking | humans vs machine + prize. Square corners on desktop.
- Tests: web 49 (hub meta now "· Liiga"); Playwright projects `mobile` (390x844) and `desktop` (1440x900), screenshots in `apps/web/e2e/screenshots/{mobile,desktop}/`, no horizontal scroll at 360 / 900 / 1440 on every screen. 3 design-check rounds.
- Known differences: the desktop Before header shows "18:30", not "TODAY 18:30" (the game may not be today); the hero shows the AI line and "your picks" on two lines; the hero headline gives the stake if the team wins (the model has no current value for "from 34% to 27%"); the "Demo replay" badge row stays in demo mode; the long "Fan poll: best player so far" title wraps in the sidebar; mobile/desktop exact score keeps the team names and the score note.
- Open: the API on :3000 used by the e2e is an old process without the step 3 demo AI routes, so demo screenshots show the labelled sample AI pick. Restart the API to see real demo predictions.

### 2026-10-24 · Step 3: prediction_model + ai_predictions ✅
- `packages/prediction_model` (pure, seeded mulberry32): `season_config` (17 teams, points, playoff 12 / top 4 / relegation 3 from Liiga `playoffsLines`, VERIFY), `team_strength` (opponent-adjusted, half-life 10 games, shrunk to average), `game_probabilities` (Poisson 60 min + OT split, predicted score), `season_simulation` (10,000 runs, one random number per game), `stakes` (forced home/away win, same seed), `live_win_chance` (+ timeline), `top_scorer_pick`, `reasons` (8 fact types, templates, up to 3 that favour the pick), `predict_game`, `backtest` (+ Markdown).
- API: migration `0007_model_details`; module `ai_predictions` (repositories, pure mapper + `model_inputs`, service, demo service, controller, routes): `GET /games/:id/ai_prediction`, `GET /games/:id/win_chance`, `GET /standings/odds`, `GET /demo/games/:id/ai_prediction|win_chance`. `jobs/run_model.ts`: `RunModelJob` (input-hash skip, 7-day window, keeps started games' picks) + `ModelRunScheduler` (background, merged requests); runs on API start, after `sync:liiga`, and when live sync sees a final. Scripts: `model:run`, `backtest`. Real Liiga rows only; demo fill-ins are never predicted.
- Shared: `packages/shared_types/src/ai_predictions.ts` (AI schemas moved out of `game_extras.ts`, new shapes).
- Web: real endpoints (demo paths in demo mode) for the AI pick card, stakes card, hub AI lines, scorer "AI pick" tag (always listed), live win-chance chart (Start / score / Now / End), predicted score as the stepper's start, "· Calculated HH:MM" label. `PREDICTION_NOT_READY` → "not ready" card / line (no numbers). Mocks only when the endpoint fails (404 route, network, 5xx), with one console warning, labelled "Sample data".
- Real data (2026-10-24): 8 games today, e.g. Kärpät–KalPa: Kärpät 67%, 3–2, Päkkilä; model run 23 games + 17 teams in 6.8 s. Back-test 2025-26: 63.1% / Brier 0.2350 (baseline 55.0% / 0.2472), see `reliability_testing.md`.
- Tests: prediction_model 49, api 171, web 49, shared_types 7; Playwright e2e 2 (new screenshots in `apps/web/e2e/screenshots/`).
- Also: `config/env.ts` skips an empty `.env` (the empty `apps/api/.env` no longer hides the root one).
- Open: overtime under-predicted (~17% vs ~23%); strengths treated as known in the season simulation (extreme odds over-confident); scorer pick has no line-ups (VERIFY); "Most common Liiga result this season: 3–2" in the score note is still a fixed text, not computed; a running API must be restarted to load the new routes.

### 2026-10-24 · Step 8 (pulled forward): PWA UI, 5 screens ✅
- `apps/web`: hub, Before / During / After (picked from the game's state), Leaderboard; 390 px phone first, centered 430 px column on desktop. Tokens, fonts (@fontsource Barlow Condensed + Inter, self-hosted) and copy from `docs/design/`.
- Structure: `app/` (router, providers, shell), `styles/`, `components/` (shared UI, CSS Modules), `features/<screen>/` (api.ts hooks, copy.ts, components, page), `lib/` (api_client, format, storage, picks, points, demo_mode), `mocks/`.
- Real API first: game day, game detail, demo replay, team players. Sample data (each with a `TODO(step N)` comment) for AI prediction, win chance, highlight, story, quiz, fan poll, `/me`, leaderboard. Each hook calls the future endpoint and falls back on 404 `NOT_FOUND` (console warning once). New contracts in `packages/shared_types/src/game_extras.ts`.
- Picks in localStorage per game; lock-in until puck drop; points from a pure, tested `compute_game_points()` (design case: you 38, AI 25).
- Demo mode: `?demo=1` (or `VITE_DEMO_MODE=true`), moment in the URL (`?moment=before|live|final`), "Demo replay" badge.
- Tests: web 42 unit/component (Vitest + Testing Library); Playwright e2e 2 (installed Chrome, 390x844) with screenshots in `apps/web/e2e/screenshots/`; 3 design-check rounds.
- Known differences from the design: real replay data (Kärpät–KalPa 5–2, start times from the replay shift, real player names), no preselected picks, the "Demo replay" badge row, period-end rows in game events.
- Open: the empty `apps/api/.env` still makes `pnpm test` fail for the api (run from the repo root instead). Fixed in step 3.

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
