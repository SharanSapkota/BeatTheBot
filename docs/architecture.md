# Architecture

## Overview
```
Liiga API ──► sync_games job ──► PostgreSQL ◄── repositories      (demo fill-ins: data_source = 'demo')
                                     │
                    prediction_model (pure) ──► ai_predictions
                                     │
               build_fact_sheet ──► LLM writer ──► check_claims
                                     │
                     stories (status: green / yellow / red)
                                     │
                 editor form (approve stories, add highlight)
                                     │
        API /api/v1 (Bearer auth) ──► apps/web PWA (MVP)
                                  └─► same app as widget.js (Shadow DOM) on kaleva.fi (step 10)
```

## Monorepo
| Path | Role |
|---|---|
| `apps/api` | Express REST API + jobs |
| `apps/web` | Main app, a **PWA** (Vite, vite-plugin-pwa, TanStack Query, react-router) |
| `apps/widget` | Step 10: embed build to one `widget.js`, reusing `apps/web` components |
| `apps/editor` | MVP: minimal highlight form + story approval. Full admin later |
| `apps/demo_site` | Kaleva-style article page on localhost |
| `apps/extension` | Chrome MV3 extension (demo only) |
| `packages/shared_types` | zod schemas + types shared by api and frontends |
| `packages/prediction_model` | Pure math: team strength, game probabilities, season simulation |
| `packages/fact_checker` | `build_fact_sheet()`, `check_claims()` |
| `packages/i18n` | Locale files + helpers (MVP: `fi` only) |
| `packages/config` | Shared tsconfig, eslint, prettier |

Packages depend on nothing app-specific. Apps depend on packages, never on each other. Internal packages export TypeScript source directly (no build step); `tsup` bundles them into the API build.

Shared components between `apps/web` and `apps/widget` will move into a package when the widget is built, so apps still never import each other.

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

## Data sources
- Real Liiga data first. Rows created to fill gaps (missing games, events or players for the demo) get `data_source = 'demo'`; synced rows get `'liiga_api'`.
- Sync never overwrites a `liiga_api` row with demo data. The UI may show a small "demo data" tag on demo rows.

## Content pipeline (one game)
1. `sync_games` stores games, events and standings.
2. Before the game: `prediction_model` runs, then `ai_predictions` (pick, %, reasons, stakes).
3. After the final horn: `build_fact_sheet(game_id)` creates the list of verified facts.
4. The LLM writes the story **only** from the fact sheet.
5. `check_claims(text, fact_sheet)` checks the text. If it fails, regenerate (max 2), then send to human.
6. A traffic light is assigned. Green auto-publishes; yellow and red wait for editor approval in the editor form.
7. The app shows only `published` items, with labels.

## PWA (`apps/web`)
**Plugin:** `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`.

**Web app manifest**
| Field | Value |
|---|---|
| `name` / `short_name` | `Voita kone` / `Voita kone` |
| `display` | `standalone` |
| `start_url` | `/` |
| `theme_color` | `#111111` |
| `background_color` | `#F3F3F3` |
| `icons` | 192×192, 512×512, plus a `maskable` 512 |

Also: `apple-touch-icon`, and iOS meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`).

**Caching (Workbox)**
| Request | Strategy |
|---|---|
| App shell (HTML, JS, CSS, icons, fonts) | Precached at build |
| `GET` games, standings, AI predictions, leaderboard | `NetworkFirst`, short network timeout (~3 s), fallback to cache |
| `POST` / `PUT` / `PATCH` / `DELETE` | Never cached |
| `/auth/*`, `/me/*` | Never cached (`NetworkOnly`) |

**Offline**
- Show the last cached data with a banner: **"Offline, showing saved data"**.
- Picks made offline are **blocked** with a clear message. No silent queueing or background sync in the MVP.

**Updates and install**
- When a new service worker is waiting, show an **"Update available"** toast; tapping it reloads into the new version.
- Optional **"Install app"** button using `beforeinstallprompt` (Android / desktop Chrome). On iOS, a short hint: Share → Add to Home Screen.

**Layout:** mobile-first from the design (390px phone), works up to desktop.

**Done when:** Lighthouse PWA / installability checks pass.

**LATER:** web push ("Game starts in 30 min", "Next-goal pick open").

## Accounts
Designed so one person keeps the same points whether they use the PWA, the embed on kaleva.fi, or (later) email.

**Model** (details in `data_model.md`)
- `users`: the person (display name, role, language). **No login data.**
- `auth_identities`: how a user signs in. `provider` = `device` | `email` | `kaleva`, `provider_subject` = the ID within that provider. Unique (`provider`, `provider_subject`). One user can have many identities.
- `sessions`: random 32-byte token, only its hash stored, 90-day expiry.

**Transport:** auth is **always** `Authorization: Bearer <token>`. No cookies, so the same API works in the PWA and in an embed on another domain (no third-party cookie problems).

**NOW (MVP): device sign-in**
1. Browsing needs no account.
2. On the first "Lock in my picks", the app asks for a display name.
3. `POST /auth/device { display_name }` creates a `user`, a `device` identity (random subject) and a session, and returns `{ token, user }`.
4. The PWA stores the token in `localStorage` under `voita_kone_session` and sends it as a Bearer header.

**LATER (documented, not built in the MVP)**

a) **Kaleva Media SSO (OIDC).** `POST /auth/kaleva/callback` exchanges the OIDC code, reads the `sub` claim, and finds or creates the user for the `kaleva` identity with that subject. Returns `{ token, user }`.

b) **Connect Kaleva account** (in the PWA, signed in as current user U). `POST /me/identities/kaleva` runs the OIDC flow and adds a `kaleva` identity to U.
- If that Kaleva subject is not linked yet: insert the identity for U. Done.
- If it already belongs to another user K: **merge** U into K, in one DB transaction:
  1. Move U's `user_predictions` and `user_answers` to K. On a unique conflict (both answered the same game/question), keep K's row and drop U's.
  2. Move U's other `auth_identities` (e.g. the `device` one) to K.
  3. Revoke U's sessions; issue a new session for K and return `{ token, user }`.
  4. Recompute K's points (leaderboard reads from the moved rows).
  5. Delete the now-empty user U.
- **Test plan:** link with no existing Kaleva user; link when K exists with no overlap; overlap on the same game (K's pick kept); overlap on the same question; points total equals the recomputed sum; old token for U returns `401`; U is deleted; the `device` identity now resolves to K; merge rolls back fully if any step fails; linking a Kaleva subject already on U is a no-op.

c) **Embed on kaleva.fi** signs in with the Kaleva identity, so the reader is the **same user with the same points** as in the PWA.

d) **Email OTP** adds an `email` identity the same way (cross-device without Kaleva).

## Embedding (step 10)
- Production: `<script src=".../widget.js" data-game="<game_id>"></script>`
- The widget is the same app (`apps/web` components), mounted in a **Shadow DOM** (CSS isolation), calling the API with CORS-allowed origins and a Bearer token.
- Demo: the extension's content script mounts the widget on kaleva.fi; the background script calls `localhost`. See `widget_and_extension.md`.

## Cross-cutting
- **Config**: `config/env.ts`, zod-validated. The app crashes on startup if config is invalid.
- **Errors**: `AppError(code, http_status, message)`, one error middleware, response `{ error: { code, message } }`.
- **Logging**: pino with `request_id`.
- **Security**: helmet, CORS allowlist, rate limit on write endpoints (incl. `POST /auth/device`), zod on all input.

## Testing
| Level | Tool | Target |
|---|---|---|
| Pure packages | Vitest | ~100% of model + checker |
| Services | Vitest + fakes | All business rules |
| Controllers | Supertest | Happy path + validation errors |
| PWA | Lighthouse | PWA / installability pass |
| Reliability | Scripts | See `reliability_testing.md` |
