# Setup (local development)

## Requirements
- Node.js 20+, pnpm 9+, Docker, Chrome

## First run
```
pnpm install
cp .env.example .env            # fill in LIIGA_API_KEY and LLM_API_KEY
docker compose -f infra/docker-compose.yml up -d
pnpm --filter api db:migrate
pnpm --filter api db:seed       # demo users + sample games (works without the Liiga key)
pnpm dev
```

## Local URLs
| App | URL |
|---|---|
| API | http://localhost:3000/api/v1/health |
| Widget dev | http://localhost:5173 |
| Editor dashboard | http://localhost:5174 |
| Demo site | http://localhost:5175 |
| Mailpit (see login code emails) | http://localhost:8025 |

Sign in as an editor: use an email listed in `ADMIN_EMAILS`, then read the code in Mailpit.

## Useful commands
```
pnpm lint | pnpm typecheck | pnpm test
pnpm --filter api sync:games            # pull Liiga data
pnpm --filter api reliability:golden    # reliability test 1
pnpm --filter api reliability:planted   # reliability test 2
pnpm --filter prediction_model backtest
pnpm --filter extension build           # then Load unpacked in Chrome
```

## Seed data
The seed makes the demo work **offline**: 2 past games with full events and results, 2 upcoming games, 5 demo users with picks. Use it if the API or Wi-Fi fails during judging.
