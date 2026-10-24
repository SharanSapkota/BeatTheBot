# Architecture

## Overview
```
Liiga API ──► sync_games job ──► PostgreSQL ◄── repositories      (demo fill-ins: data_source = 'demo')
                                     │
                    prediction_model (pure) ──► ai_predictions ("Data says")
                                     │
   build_fact_sheet (preview | summary) ──► LLM writer or template ──► classify_claims
                                     │
                     stories (traffic light: green / yellow / red)
                                     │
            /editor page (approve / edit / reject) · reader reports · audit_log
                                     │
   /admin page (admin) ──► elections + candidates ──► election_picks ──► election leaderboard (no AI)
                                     │
        API /api/v1 (Bearer auth) ──► apps/web PWA (MVP)
                                  └─► same app as widget.js (Shadow DOM) on kaleva.fi (step 14)
```

## Monorepo
| Path | Role |
|---|---|
| `apps/api` | Express REST API + jobs |
| `apps/web` | Main app, a **PWA** (Vite, vite-plugin-pwa, TanStack Query, react-router), incl. the `/editor` story review page and the `/admin` page |
| `apps/widget` | Step 14: embed build to one `widget.js`, reusing `apps/web` components |
| `apps/editor` | Step 12: minimal highlight form. Full admin later |
| `apps/demo_site` | Kaleva-style article page on localhost |
| `apps/extension` | Chrome MV3 extension (demo only) |
| `packages/shared_types` | zod schemas + types shared by api and frontends |
| `packages/prediction_model` | Pure math: team strength, game probabilities, season simulation |
| `packages/scoring` | Pure points rules (incl. bold call), shared by api and web |
| `packages/fact_checker` | Fact sheet types, `classify_claims()`, `check_claims()`, `find_tips()`, `find_escalation_words()` |
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
The AI is a guide, not a player: it writes an **AI preview** before the game and an **AI summary** after it. Details: `content_generation.md`, `fact_checker.md`, `editorial_rules.md`.
1. `sync_games` stores games, events and standings.
2. Before the game: `prediction_model` runs and stores `ai_predictions`. The app shows them only as **"Data says"** (win chance + stakes); no AI pick.
3. Code builds a fact sheet (`fact_sheets.kind`): `preview` (form, head to head, home/away record, player form, table position, win chance, stakes) before puck drop, `summary` (final score, goals, winning goal, standing and season odds before → after, next game) when the game is final. Every fact has an id (`f1`, `f2`, …) and a `source`.
4. The LLM writes the text **only** from the fact sheet, each sentence citing its fact ids. Preview = exactly 3 bullets; summary = one paragraph (60–90 words).
5. `classify_claims` marks every claim `verified`, `not_found` or `wrong`; `find_tips` and `find_escalation_words` scan the text. On failed claims, retry up to 2 times with the failed claims listed.
6. **Template fallback:** no LLM key, or the LLM call fails (network / 5xx / timeout) → template text from the same fact sheet, also checked, source `template`, green, label "Automatic preview/summary from Liiga data".
7. Traffic light (reasons stored in `stories.check_result.traffic_light_reasons`):
   - 🟢 every claim verified, no tip, no sensitive topic → auto-published.
   - 🟡 any `not_found` claim, or a story type not in the auto-publish list (`preview`, `summary`) → one-tap editor approval.
   - 🔴 any `wrong` claim, a tip/prediction of a winner, an injury/legal/personal topic, or an LLM error (empty / unusable output, wrong length) → full review, never auto-published.
8. The app shows only `published` / `corrected` stories, with labels, a "Report an error" button and a correction note if edited after publishing. Nothing published → "Preview coming soon" / "Summary coming soon".
9. **Reports:** `POST /stories/:id/reports` writes `error_reports` and `audit_log` and sends the story back to 🟡 `in_review` (hidden until approved again).
10. **Editor page** (`/editor`, `require_role('editor' | 'admin')`): queue of in_review stories with the text next to the fact sheet and claims marked; approve, edit (checker re-runs; any `wrong` claim → `422 CHECK_FAILED`) or reject. Editing a published story makes it `corrected` (correction note + time). Every action writes `audit_log`.

## Navigation (`apps/web`)
Four main menus, from one list (`components/use_main_nav.ts`): **Games** (`/games`, the hub and `/games/:id`), **Elections** (`/elections`, `/elections/:id`), **Rooms** (`/rooms`, `/rooms/new`, `/rooms/join/:key`, `/rooms/:id`), **Leaders** (`/leaders`, tabs Games / Elections).
- Mobile (< 900 px): bottom nav, icon + label, each item at least 44 px high.
- Desktop (≥ 900 px): the same items in the Kaleva header, active item with the 4 px orange underline.
- Redirects keep old links working: `/` → `/games`, `/leaderboard` → `/leaders` (query string kept, so `?demo=1` survives).
- Desktop-first staff pages, not in the nav: `/editor` (role editor or admin) and `/admin` (role admin; first tab Elections).

## Roles and audit
- `users.role` = `user` | `editor` | `admin` (default `user`). Set with `pnpm --filter api make:editor -- --user_id <id>` / `make:admin -- --user_id <id>`.
- Every admin route calls `require_role(req, ["admin"])`: anonymous → `401`, other roles → `403 FORBIDDEN`. Editor routes accept editor and admin.
- `audit_log` (actor, action, entity = `target_type`, entity id = `target_id`, `details` jsonb, `created_at`) gets one row per admin or editor change, written in the same transaction as the change.

## Elections (step 7)
No AI in elections: no LLM text, no model numbers. Admins write every text about a candidate.

**Flow:** admin creates a `draft` election with at least 2 candidates → previews the user view → `published` (users can pick from `poll_opens_at` until `poll_closes_at`, server clock) → `closed` (by the admin, or the poll close time passes) → `resulted` (the admin picks the winner; optional vote counts). Entering the result scores every pick in the same transaction (20 points if `candidate_id` = winner, else 0). Entering it again (a correction) re-scores with the same rule, so the result is idempotent.

**Time rules:** `poll_opens_at` < `poll_closes_at` ≤ voting close = 20:00 Helsinki time on `election_date`. Picks before `poll_opens_at` → `409 POLL_NOT_OPEN`; at or after `poll_closes_at`, or once the election is closed → `409 POLL_CLOSED`.

**Results rule** (pure, `modules/elections/election_results.ts`): the share of picks per candidate is shown only when (the user has picked OR the poll has closed) AND there are at least 20 picks. Otherwise the API returns `shares: null` and a reason (`pick_first` | `not_enough_picks`). Every result carries "Not a scientific poll. Shows only the picks of Voita Kaleva users."

**Fairness rules** (tested in `candidate_order.test.ts`, `election_results.test.ts`, `elections_controller.test.ts`):
1. We ask for a **prediction** ("Who will get the most votes in <area>?"), never "Who will you vote for?". `election_picks` stores only the prediction; no personal vote intention is stored anywhere.
2. **Candidate order is random per user:** a seeded shuffle with the seed `user_id + election_id`, so a signed-in user always sees the same order and two users usually see different ones. Anonymous users get a new random order per visit. The results bars follow the same order (never sorted by party or by share).
3. **Same card for every candidate:** one card design, no party colours, no logos, no AI-written text (bio max 200 chars, written by the admin; photo optional, `https` only, else initials).
4. **Points:** correct prediction = 20 points, on a **separate election leaderboard** (Leaders → Elections), not in the games points. No prizes for election picks.
5. **Delete:** deleting a user deletes their election picks (`ON DELETE CASCADE`).
6. **Demo data:** only fictional candidates (invented names); real politicians' names are never used in seed or test data. Demo elections have `is_demo = true` and show a "Demo" badge.

## Rooms (step 9)
A private room for a group (club, friends, workplace). Module `modules/rooms` (routes → controller → `RoomsService` → `KyselyRoomsRepository`); pure helpers with tests: `join_key.ts`, `room_slots.ts`, `question_picker.ts`, `room_reveal.ts`.

- **Join key:** 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L), from the crypto generator; a clash with an existing key (unique constraint) retries with a new key, max 10 tries. The owner can make a new key (the old one stops working). Keys are never logged or printed by scripts. The typed key is upper-cased; any 6 letters/digits are accepted (the seeded demo key `DEMO26` has an "O").
- **Limits:** joins 10 per IP per minute (`create_rate_limit`, in memory, against key guessing); a user owns at most 10 active rooms; `max_members` (default 100, checked with the room row locked).
- **Private:** every room read and write (room, questions, answers, reactions, scoreboard) needs membership → `403 NOT_A_MEMBER`. The owner can't leave (closes the room instead); a closed room has no current question and no joins.
- **Slots:** `slot_index = slot_base + floor((now − schedule_started_at) / interval)`; a new room starts with `schedule_started_at = created_at`, `slot_base = 0` (= `floor((now − created_at) / interval)`). A new interval (owner, `PATCH`) starts after the current slot (`schedule_started_at` = the current slot's end, `slot_base` = current + 1), so no slot is skipped or cut short.
- **Rotating questions:** the current question is created on the first request of its slot (`unique (room_id, slot_index)` + insert-or-ignore, so parallel requests are safe). `QuestionGenerator` interface: `MockQuestionGenerator` (JSON banks in `modules/rooms/mock_questions/`, ≥ 40 per topic, trivia + opinion, simple well-known facts, no politics or elections); `LlmQuestionGenerator` (env `ROOM_QUESTIONS_SOURCE=llm`; not built yet, TODO, always falls back to the mock bank). No repeats in a room until the bank is used up (then the least used questions), seeded by `room_id:slot`; the option order is shuffled with the same seed.
- **Reveal:** a question is open for its whole slot; from `locks_at` on it is revealed: right answer, the room's split per option, who got it right, reactions (🔥 😂 😮 👏 😡, toggle).
- **Points:** trivia right = 3, opinion = 1 for answering (`packages/scoring/src/rooms.ts`), stored server-side when the answer is saved (one answer per user and question, so idempotent) and shown only after the reveal. The room scoreboard (week Mon–Sun Helsinki / all time) counts revealed questions only. **Room points never count on the global leaderboard or in `GET /me` `total_points`** (demo rooms included).
- **Live updates:** the web app polls every 5 s (TanStack Query `refetchInterval`, paused while the page is hidden). No websockets yet.
- **Dev/e2e fake clock:** `pnpm --filter api rooms:advance_slot -- --room_id <id>` moves one room's schedule and questions one interval back (refuses in production).
- **Demo:** "Kärpät fans Oulu", key `DEMO26`, 60 s, `is_demo`, 8 fictional members with 12 revealed questions answered (`db:seed`, or only the room: `rooms:seed_demo`).

## Jobs (JobScheduler, idempotent)
| Job | What | Runs |
|---|---|---|
| `run_model` | `prediction_model` for games up to 7 days ahead | API start, after `sync:liiga`, live sync sees a final |
| `score_predictions` | Fills `points_awarded`; re-scores picks of final games whose `scoring_version` is lower than the current one (2) or never scored | API start, live sync sees a final, after `sync:liiga`, after `db:seed` |
| `score_answers` | Decides live picks | API start, after live sync updates, game ends, after `sync:liiga` |
| `generate_stories` | Previews for games starting in the next 7 days and games finished in the last 7 days without a preview; refreshes a preview once in the 2 h before puck drop (if its sheet was built before start − 2 h); a summary when a game turns final (last 7 days, none yet) | API start, every 10 min, after `sync:liiga`, live sync sees a final |

## PWA (`apps/web`)
**Plugin:** `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'`.

**Web app manifest**
| Field | Value |
|---|---|
| `name` / `short_name` | `Voita Kaleva` / `Voita Kaleva` |
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
| `GET` games, standings, "Data says", stories, leaderboard | `NetworkFirst`, short network timeout (~3 s), fallback to cache |
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

## Embedding (step 14)
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
