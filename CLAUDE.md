# CLAUDE.md — Voita Kaleva (fans vs fans)

## 1. What we are building
A hackathon prototype for **Kaleva Media** (Finnish regional media group, Oulu).
Challenge: an AI-powered sports content product that people subscribe to and advertisers pay for, built on **Liiga** (Finnish ice hockey league) data.

**Product ("Voita Kaleva" in the UI; code and package names still say `voita_kone`):** before every Liiga game, fans predict the winner, exact score and a scorer, and compete against **other fans**. The AI is **not a player**, it is a guide:
- Before the game: **AI PREVIEW** (form, history, what's at stake): 3 short bullets + "Last meetings" list.
- After the game: **AI SUMMARY** (short story, 60–90 words).
- Model numbers are shown only as neutral info labelled **"Data says"**: win chance and what's at stake (playoff / top-4 / relegation odds if they win or lose). No AI pick, no AI score, no AI scorer, no "You vs AI".
- Delivered as a **Progressive Web App first** (`apps/web`). Later the **same app** is embedded on kaleva.fi and accounts are connected (Kaleva identity).

**Hackathon MVP = 5 screens only** (details: `docs/product.md`):
1. **Game day hub:** today's games with the fans' split ("Fans: 62% Kärpät" or "Be the first to pick"); tapping a game opens the screen for its state (upcoming → Before, live → During, final → After). Bottom nav: Games, Leaders.
2. **Before the game:** AI preview + "Data says" (win chance + stakes); user picks winner, exact score, scorer (players tagged "In form"); "Lock in my picks".
3. **During the game:** next-goal pick, goal-in-period pick, "Data says: win chance", game events.
4. **After the game:** result, highlight (added by a Kaleva editor), points breakdown, AI summary, result quiz, player vote.
5. **Leaderboard:** fans only (no AI row), your accuracy vs all fans, weekly/season ranking, sponsor prize slot.

Plus a desktop-first `/editor` page (story queue, approve / edit / reject).

- **Data:** real Liiga data first; demo data only to fill gaps (`data_source = 'liiga_api' | 'demo'`).
- **Accounts:** device sign-in (`POST /auth/device`, name asked on first lock-in), Bearer token, designed so a Kaleva identity can be linked later.
- **LATER (do NOT build unless asked):** daily games, email OTP, languages (sv, en), private leagues beyond rooms (step 9), full admin app, web push.



Season context: Liiga 2026/27 is a one-off 17-team "superseason" with 3 relegated teams, so stakes are high every game.

## 2. Non-negotiable rules (editorial and legal)
1. **Numbers come from code, never from the LLM.** The prediction model computes odds. The LLM only writes text from a verified **fact sheet**.
2. **Every AI text and video passes the fact checker.** All numbers, names and dates must match the fact sheet. If anything fails, regenerate or send to a human.
3. **Traffic light review:**
   - 🟢 Green (scores, standings, odds, leaderboard, and AI preview/summary text where **every claim is verified** against the fact sheet, with no tip and no sensitive topic): auto-publish, labelled, spot-checked.
   - 🟡 Yellow (any claim not found in the fact sheet, other story types, clips): an editor approves with one tap.
   - 🔴 Red (a wrong claim, a tip/prediction of a winner, injuries, discipline, legal or personal topics, quotes, minors, prize winners, LLM errors): full human review, never auto-published.
   - A reader report sends a published story back to 🟡 review (hidden until approved again).
4. **Label all AI content.** "Written with AI from Liiga data · checked by Kaleva" (template text: "Automatic preview/summary from Liiga data"). Every item has a "Report an error" button. A correction updates every place the item appears (JSN rule 35).
5. **Video:** AI only cuts and captions **real** footage. No synthetic footage. No cloned voices of real people.
6. **Game rules:** free to play, prizes by skill (points), no betting-company sponsors, no betting content near junior or minor content.
7. Follow the Finnish **Journalist's Guidelines (JSN)**. Editorial decisions always stay with humans.

## 3. Tech stack
- **Monorepo:** pnpm workspaces (versions pinned once in the `catalog:` of `pnpm-workspace.yaml`). Node.js 24 (`.nvmrc`), TypeScript `strict`.
- **Internal packages** have no build step: they export TypeScript source (`"exports": "./src/index.ts"`).
- **API:** Express, zod (validation), Kysely + PostgreSQL (snake_case columns), pino (logging).
- **Frontend:** `apps/web` is the main app, a **PWA**: React + Vite + TanStack Query + react-router. Mobile-first (390px phone design), works up to desktop.
- **PWA:** `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`, web app manifest (name/short_name "Voita Kaleva", `display: standalone`, `start_url: "/"`, `theme_color #111111`, `background_color #F3F3F3`, icons 192/512 + maskable, apple-touch-icon, iOS meta tags). App shell precached; GET games/standings/predictions/leaderboard use NetworkFirst (short timeout, cache fallback); never cache POST/PUT or auth endpoints. Offline banner, picks blocked offline, "Update available" toast. Lighthouse PWA/installability must pass. Details: `docs/architecture.md`.
- **Auth:** always `Authorization: Bearer <token>` (no cookies), so the same API works in the PWA and in an embed on another domain.
- **Embed (step 14):** the same `apps/web` components built as a single `widget.js` (Vite library mode), mounted in a **Shadow DOM** so Kaleva's CSS can't affect it. Demo via Chrome MV3 extension.
- **i18n:** i18next + react-i18next; UI strings in `packages/i18n/locales/`. No hardcoded UI text. MVP ships `fi` only; `sv`/`en` later.
- **Email (later):** nodemailer + Mailpit in Docker, only when email OTP is built.
- **Tests:** Vitest + Supertest. **Lint/format:** ESLint + Prettier.
- **Local infra:** Docker Compose (Postgres, Mailpit).

## 4. Folder structure
```
voita_kone/
├── CLAUDE.md
├── package.json / pnpm-workspace.yaml
├── .env.example                 # never commit .env
├── infra/docker-compose.yml     # postgres + mailpit
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── app.ts / server.ts / container.ts / routes.ts
│   │       ├── config/env.ts                  # zod-validated env
│   │       ├── common/                        # app_error, error/not_found/request_id middleware, logger
│   │       ├── db/                            # kysely.ts, migrations/, seed/
│   │       ├── integrations/
│   │       │   ├── liiga_client/              # Liiga API client (+ interface)
│   │       │   └── llm_client/                # LLM client (+ interface)
│   │       ├── jobs/                          # sync_games.ts, generate_stories.ts
│   │       └── modules/
│   │           ├── games/
│   │           │   ├── games_routes.ts
│   │           │   ├── games_controller.ts
│   │           │   ├── games_service.ts
│   │           │   ├── games_repository.ts
│   │           │   ├── games_schemas.ts       # zod request/response
│   │           │   └── games_service.test.ts
│   │           ├── auth/                      # device sign-in, identities, sessions, role guard (email OTP / Kaleva SSO later)
│   │           ├── users/                     # profile, history, delete
│   │           ├── predictions/               # before-game picks + scoring
│   │           ├── questions/                 # live picks, result quiz, player vote (daily games later)
│   │           ├── ai_predictions/            # model output shown as "Data says" (win chance, stakes) + crowd split
│   │           ├── leaderboard/               # fans only
│   │           ├── stories/                   # AI preview + AI summary, status/label, reader reports
│   │           ├── highlights/                # editor-added game highlight
│   │           └── review/                    # editor queue (traffic light), approve/edit/reject, corrections, audit_log
│   ├── web/                                   # main app, PWA (Vite + vite-plugin-pwa, port 5173), incl. the /editor page
│   ├── widget/                                # step 14: embed build -> widget.js, reuses apps/web components
│   ├── editor/                                # step 12: minimal highlight form (full admin later)
│   ├── demo_site/                             # Kaleva-style localhost article page
│   └── extension/                             # manifest.json, content_script.ts, background.ts
├── packages/
│   ├── shared_types/        # zod schemas + TS types shared by api and frontends
│   ├── prediction_model/    # pure functions: team strength, Monte Carlo season sim
│   ├── scoring/             # points rules (pure, incl. bold call), shared by api and web
│   ├── fact_checker/        # fact sheets, classify_claims(), check_claims(), find_tips() (pure, fully tested)
│   ├── i18n/                # locale files fi/sv/en + helpers
│   └── config/              # shared eslint, prettier, tsconfig.base.json
├── README.md
└── docs/
    ├── product.md               # idea, user flow, scoring, business model
    ├── architecture.md          # layers, data flow, content pipeline
    ├── editorial_rules.md       # traffic light, labels, JSN, corrections
    ├── data_model.md            # tables + relations
    ├── api.md                   # endpoints
    ├── data_sources.md          # Liiga API mapping, season config
    ├── prediction_model.md      # Poisson + Monte Carlo, stakes, back-test
    ├── fact_checker.md          # fact sheet format, check_claims rules
    ├── content_generation.md    # LLM prompt rules, story types
    ├── widget_and_extension.md  # embed, Shadow DOM, demo extension
    ├── reliability_testing.md   # golden set, planted errors, results
    ├── judging_criteria.md      # Kaleva criteria → our answers
    ├── setup.md                 # local run, URLs, seed data
    ├── progress.md              # what is done / next step
    └── decisions/               # short ADRs (0001–0004)
```
**Read only the doc for the current step**, e.g. step 5 → `fact_checker.md` + `content_generation.md`.

## 5. Layer rules (api)
- **routes** → wire URL to controller. Nothing else.
- **controller** → HTTP only: validate input with zod, call one service method, map to response. No business logic, no DB.
- **service** → business logic only. No `req`/`res`, no SQL. Gets repositories and clients through the **constructor** (dependency injection), so it can be tested with fakes.
- **repository** → database only (Kysely). Returns typed objects. No business rules.
- **integrations** → external APIs behind an interface (`LiigaClient`, `LlmClient`) so they can be mocked.
- Errors: throw `AppError` (code, http_status, message). One error middleware formats responses.
- API is versioned: `/api/v1/...`. Responses: `{ data }` or `{ error: { code, message } }`.

## 6. Coding conventions
- **snake_case** for variables, functions, file names, DB tables and columns, JSON fields.
- **PascalCase** only for types, interfaces, classes and React component names (React requires this).
- Exception: React custom hooks are camelCase `useSomething` (the react-hooks lint rules require it). ESLint enforces naming.
- Descriptive names, small functions, readable code over clever one-liners. No `any`.
- Config only from `config/env.ts`. No secrets in code. No hardcoded URLs.
- Every service and every pure package function gets unit tests. Controllers get Supertest tests.
- Commit messages: `type(scope): short message` (e.g. `feat(games): add list endpoint`).

## 7. How to work (develop slowly)
1. Work on **one small step at a time** from the roadmap below.
2. Before coding: write a short plan and wait for approval.
3. After coding: run `pnpm lint && pnpm typecheck && pnpm test`. All must pass.
4. Update `docs/progress.md`. Stop and ask before the next step.
5. Do not add features or dependencies outside the current step without asking.

## 8. Roadmap
Renumbered 2026-10-24 (fans vs fans). The PWA UI (5 screens, matches docs/design) was pulled forward and is done (old step 8).
- [x] 0. Monorepo setup, tooling, docker Postgres, empty api with `/health`
- [x] 1. Database schema + Liiga API sync + demo fill-ins (`data_source = 'liiga_api' | 'demo'`)
- [x] 2. Games API: today's games with state, game detail, standings
- [x] 3. `prediction_model` package + `ai_predictions` module (now shown as "Data says": win chance + stakes)
- [x] 4. Accounts (`users`, `auth_identities`, `sessions`, `POST /auth/device`) + before-game predictions + scoring + leaderboard (fans only)
- [x] 5. AI preview + AI summary + `fact_checker` + traffic light + editor page (unfinished parts → step 10)
- [x] 6. Questions: live picks (next goal, period goal), result quiz, player vote
- [x] 7. Elections: 4 main menus (Games · Elections · Rooms · Leaders), admin role + `/admin`, elections + candidates + picks + results, election leaderboard
- [x] 8. Games: sport categories (hockey, football, basketball) + fans vs fans (the AI is not a player anymore)
- [x] 9. Rooms (join key, rotating questions from mock data, LLM later; room scoreboard; reactions)
- [x] 10. AI preview + summary (finish the half-done step 5 code) + games hub never empty
- [ ] 11. Share + referral
- [ ] 12. Highlights editor
- [ ] 13. PWA features: manifest, icons, service worker, offline, update toast, install button, Lighthouse check
- [ ] 14. Embed on kaleva.fi: widget build of the same app + demo Chrome extension + account linking (Kaleva identity)
- [ ] 15. Reliability report (golden set + planted errors)

## 9. Commands
```
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm dev          # all apps (api :3000, web :5173)
pnpm test | pnpm lint | pnpm typecheck
pnpm --filter api db:migrate
```

## 10. Token-saving rules for Claude
- Read only the files needed for the current step. Never scan the whole repo. Ask if unsure where something is.
- Keep answers short: show diffs and changed files, not whole files again. No long explanations unless asked.
- Run tests with failure-only output (e.g. `pnpm test --reporter=dot`).
- Use subagents for long logs or doc lookups, so only a summary returns.

## Compact instructions
When compacting, keep: current roadmap step, files changed, failing tests and errors, decisions made. Drop: exploration and old logs.

## 11. Open questions (ask Kaleva on Discord)
- Liiga API endpoints, auth and rate limits (`LIIGA_API_KEY` in `.env`)
- Does the API include player stats per game?
- Can we use real highlight clips, or data only?
- Any sponsor or prize partners? A staging environment or widget guidelines?
- Kaleva Media SSO (OIDC) details for account linking (step 12)? Device sign-in is used for the MVP.
