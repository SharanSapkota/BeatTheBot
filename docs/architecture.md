# Architecture

## Overview
```
Liiga API ──► sync_games job ──► PostgreSQL ◄── repositories
                                     │
                    prediction_model (pure) ──► ai_predictions
                                     │
               build_fact_sheet ──► LLM writer ──► check_claims
                                     │
                     stories (status: green / yellow / red)
                                     │
                 editor app (approve / edit / reject)
                                     │
        API /api/v1 ──► widget.js (Shadow DOM) ──► demo_site / kaleva.fi (via extension)
```

## Monorepo
| Path | Role |
|---|---|
| `apps/api` | Express REST API + jobs |
| `apps/widget` | Embeddable React widget, built to one `widget.js` |
| `apps/editor` | React review dashboard |
| `apps/demo_site` | Kaleva-style article page on localhost |
| `apps/extension` | Chrome MV3 extension (demo only) |
| `packages/shared_types` | zod schemas + types shared by api and frontends |
| `packages/prediction_model` | Pure math: team strength, game probabilities, season simulation |
| `packages/fact_checker` | `build_fact_sheet()`, `check_claims()` |
| `packages/config` | Shared tsconfig, eslint, prettier |

Packages depend on nothing app-specific. Apps depend on packages, never on each other.

## API layers
```
routes → controller → service → repository → database
                         └────→ integrations (liiga_client, llm_client)
```
| Layer | Does | Never does |
|---|---|---|
| routes | Map URL + method to controller | Logic |
| controller | Validate (zod), call service, shape response | Business logic, DB |
| service | Business rules, orchestration | HTTP objects, SQL |
| repository | Kysely queries, return typed rows | Business rules |
| integration | Call external APIs behind an interface | Business rules |

Dependencies are passed through **constructors**. A single `container.ts` builds all objects, so tests can swap in fakes.

## Content pipeline (one game)
1. `sync_games` stores games, events and standings.
2. Before the game: `prediction_model` runs, then `ai_predictions` (pick, %, reasons, stakes).
3. After the final horn: `build_fact_sheet(game_id)` creates the list of verified facts.
4. The LLM writes the story **only** from the fact sheet.
5. `check_claims(text, fact_sheet)` checks the text. If it fails, regenerate (max 2), then send to human.
6. A traffic light is assigned. Green auto-publishes; yellow and red go to the editor queue.
7. The widget shows only `published` items, with labels.

## Widget embedding
- Production: `<script src=".../widget.js" data-game="<game_id>"></script>`
- The widget mounts in a **Shadow DOM** (CSS isolation) and calls the API with CORS-allowed origins.
- Demo: the extension's content script mounts the widget on kaleva.fi; the background script calls `localhost`.

## Cross-cutting
- **Config**: `config/env.ts`, zod-validated. The app crashes on startup if config is invalid.
- **Errors**: `AppError(code, http_status, message)`, one error middleware, response `{ error: { code, message } }`.
- **Logging**: pino with `request_id`.
- **Security**: helmet, CORS allowlist, rate limit on write endpoints, zod on all input.

## Testing
| Level | Tool | Target |
|---|---|---|
| Pure packages | Vitest | ~100% of model + checker |
| Services | Vitest + fakes | All business rules |
| Controllers | Supertest | Happy path + validation errors |
| Reliability | Scripts | See `reliability_testing.md` |
