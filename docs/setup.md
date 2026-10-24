# Setup (local development)

## Requirements
- Node.js 24 (see `.nvmrc`), pnpm 12 (the `packageManager` field pins the exact version), Docker, Chrome

## First run
```
pnpm install
cp .env.example .env            # fill in LIIGA_API_KEY and LLM_API_KEY
docker compose -f infra/docker-compose.yml up -d
pnpm --filter api db:migrate    # create tables
pnpm --filter api db:seed       # Liiga sync (falls back to saved fixtures offline) + demo fill-ins + demo users
pnpm dev                        # api + web
```

## Local URLs
| App | URL |
|---|---|
| API | http://localhost:3000/api/v1/health |
| Web app | http://localhost:5173 |
| Editor dashboard (step 7) | http://localhost:5174 |
| Demo site (step 7b) | http://localhost:5175 |
| Mailpit (see login code emails) | http://localhost:8025 |

Sign in as an editor: use an email listed in `ADMIN_EMAILS`, then read the code in Mailpit.

## Run the app
```
pnpm --filter api dev           # API on :3000
pnpm --filter web dev           # web app on :5173
```
- Normal: http://localhost:5173/ (today's real Liiga games)
- Demo mode, any time of day: http://localhost:5173/?demo=1 — use the "Jump in time" bar, or open a moment directly: http://localhost:5173/?demo=1&moment=live
- Demo mode always on: `VITE_DEMO_MODE=true` in `.env`.
- Picks are stored in the browser (localStorage) until accounts exist (step 4). Clear site data to start over.
- Features without an API yet show sample data; the browser console says which, once per endpoint.

## Useful commands
```
pnpm lint | pnpm typecheck | pnpm test
pnpm --filter web e2e                   # Playwright with the installed Google Chrome; screenshots in apps/web/e2e/screenshots/
pnpm format                             # prettier (Markdown is excluded)
pnpm build
pnpm --filter api sync:liiga            # pull Liiga data (add -- --fixtures to use saved responses)
pnpm --filter api db:reset              # dev only: drop all tables, migrate, seed
pnpm --filter api reliability:golden    # reliability test 1
pnpm --filter api reliability:planted   # reliability test 2
pnpm --filter prediction_model backtest
pnpm --filter extension build           # then Load unpacked in Chrome
```

## Seed data
Real Liiga data first. The seed syncs the current season; if the API can't be reached it uses the saved fixtures (`apps/api/test/fixtures/liiga/`, 9 Kärpät games, 7 rosters). Then it adds demo games (`data_source = 'demo'`) only for hub states with no real game today, and recreates the 6 demo users (1 editor, 5 players with device identities) with picks on the latest final. `pnpm --filter api db:seed -- --fixtures` works fully offline.

Note: scripts find `.env` by searching upwards from the current folder, so an `apps/api/.env` file (even an empty one) hides the root `.env`.
