# CLAUDE.md — Voita kone (Beat the AI)

## 1. What we are building
A hackathon prototype for **Kaleva Media** (Finnish regional media group, Oulu).
Challenge: an AI-powered sports content product that people subscribe to and advertisers pay for, built on **Liiga** (Finnish ice hockey league) data.

**Product:** before every Liiga game, fans predict the winner and top scorer and compete against Kaleva's AI.
- The AI shows its pick with reasons and **what's at stake** (playoff / relegation odds).
- After the game: result, short clip or animated recap, a "what it means" story, points, and a Humans vs AI scoreboard.
- Games in 3 phases + daily: before (big points), during (live picks), after (result quiz, vote), daily games (max 15 pts/day). Full table: `docs/product.md`.
- Sign-in with **email + 6-digit code** when a fan first locks in a pick; the browser remembers them for 90 days, history stays with the email.
- **Highlight of the game** is chosen and published by a Kaleva editor in the admin.
- Languages: **fi, sv, en**.
- Leaderboards and private leagues. Sponsors give prizes to the most skilled predictors.
- Delivered as an **embeddable widget**: one `<script>` line in production. For the demo, a Chrome extension shows it on kaleva.fi in our own browser only.

Season context: Liiga 2026/27 is a one-off 17-team "superseason" with 3 relegated teams, so stakes are high every game.

## 2. Non-negotiable rules (editorial and legal)
1. **Numbers come from code, never from the LLM.** The prediction model computes odds. The LLM only writes text from a verified **fact sheet**.
2. **Every AI text and video passes the fact checker.** All numbers, names and dates must match the fact sheet. If anything fails, regenerate or send to a human.
3. **Traffic light review:**
   - 🟢 Green (scores, standings, odds, leaderboard): auto-publish, labelled, spot-checked.
   - 🟡 Yellow (stories, AI explanations, clips): an editor approves with one tap.
   - 🔴 Red (injuries, discipline, quotes, minors, prize winners): full human review.
4. **Label all AI content.** Example: "AI-written from Liiga data. Checked by Kaleva sports desk, 21:47." Every item has a "Report an error" button. A correction updates every place the item appears (JSN rule 35).
5. **Video:** AI only cuts and captions **real** footage. No synthetic footage. No cloned voices of real people.
6. **Game rules:** free to play, prizes by skill (points), no betting-company sponsors, no betting content near junior or minor content.
7. Follow the Finnish **Journalist's Guidelines (JSN)**. Editorial decisions always stay with humans.

## 3. Tech stack
- **Monorepo:** pnpm workspaces. Node.js 20+, TypeScript `strict`.
- **API:** Express, zod (validation), Kysely + PostgreSQL (snake_case columns), pino (logging).
- **Frontend:** React + Vite + TanStack Query.
- **Widget:** React, built as a single `widget.js` (Vite library mode), mounted in a **Shadow DOM** so Kaleva's CSS can't affect it.
- **Extension:** Chrome Manifest V3. The content script mounts the widget; the background script calls the API.
- **Email:** nodemailer. **Local:** Mailpit in Docker catches all emails (no real sending in dev).
- **i18n:** i18next + react-i18next; UI strings in `packages/i18n/locales/{fi,sv,en}.json`. No hardcoded UI text.
- **Tests:** Vitest + Supertest. **Lint/format:** ESLint + Prettier.
- **Local infra:** Docker Compose (Postgres, Mailpit).

## 4. Folder structure
```
voita_kone/
├── CLAUDE.md
├── package.json / pnpm-workspace.yaml / tsconfig.base.json
├── .env.example                 # never commit .env
├── infra/docker-compose.yml     # postgres
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── app.ts / server.ts
│   │       ├── config/env.ts                  # zod-validated env
│   │       ├── common/                        # app_error.ts, error_middleware.ts, logger.ts
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
│   │           ├── auth/                      # email OTP, sessions, role guard
│   │           ├── users/                     # profile, language, history, delete
│   │           ├── predictions/               # before-game picks + scoring
│   │           ├── questions/                 # live picks, result quiz, daily games
│   │           ├── ai_predictions/            # model output + explanation
│   │           ├── leaderboard/
│   │           ├── stories/                   # AI content + status/label
│   │           ├── highlights/                # editor-added game highlight
│   │           └── review/                    # editor queue (traffic light), corrections
│   ├── widget/                                # embeddable React widget -> widget.js
│   ├── editor/                                # React admin: review queue, highlights, questions
│   ├── demo_site/                             # Kaleva-style localhost article page
│   └── extension/                             # manifest.json, content_script.ts, background.ts
├── packages/
│   ├── shared_types/        # zod schemas + TS types shared by api and frontends
│   ├── prediction_model/    # pure functions: team strength, Monte Carlo season sim
│   ├── fact_checker/        # build_fact_sheet(), check_claims() (pure, fully tested)
│   ├── i18n/                # locale files fi/sv/en + helpers
│   └── config/              # shared eslint, prettier, tsconfig
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
- [ ] 0. Monorepo setup, tooling, docker Postgres, empty api with `/health`
- [ ] 1. Liiga API client + `sync_games` job (teams, players, games, events into DB)
- [ ] 2. Games module (list, detail) + tests
- [ ] 3. `prediction_model` package + `ai_predictions` module (pick, %, reasons, stakes)
- [ ] 4. Email OTP sign-in + sessions, before-game predictions, scoring, leaderboard (Humans vs AI)
- [ ] 5. `fact_checker` + LLM story writer + traffic light status
- [ ] 6. Questions module: live picks, result quiz, daily games (15/day cap), generated from fact sheets
- [ ] 7. Admin app: review queue, game highlights (upload, checks, per-language approval), corrections
- [ ] 7b. Widget (Shadow DOM) with i18n fi/sv/en + demo_site page
- [ ] 8. Chrome extension for the kaleva.fi demo
- [ ] 9. Reliability report: past-season golden set + planted-error test
- [ ] 10. (Optional) clip pipeline: real footage + event timestamps + human approval

## 9. Commands
```
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm dev          # all apps
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
- Can we link to Kaleva Media accounts (SSO), or is email OTP fine for the demo?
