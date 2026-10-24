# API (v1)

Base: `/api/v1`. JSON, snake_case fields.
Success: `{ "data": ... }`. Error: `{ "error": { "code": "GAME_NOT_FOUND", "message": "..." } }`.
Auth: **always** `Authorization: Bearer <session_token>` (no cookies), so the same API works in the PWA and in an embed on another domain. Token from `POST /auth/device` (MVP). Editor/admin routes need `role` editor or admin.
Language: `?lang=fi|sv|en`, else the user's `preferred_language`, else `Accept-Language`, else `fi`. MVP serves `fi` only.
Caching: the PWA caches only `GET` games, standings, AI predictions and leaderboard. `/auth/*` and `/me/*` are never cached.

## Health
`GET /health` → `{ data: { status: "ok" } }`

## Auth (MVP: device account)
`POST /auth/device` body `{ display_name }` (1–30 chars, trimmed) → `201 { data: { token, user } }`
- Creates a `user` (role `player`), a `device` identity and a 90-day session. Rate limited per IP.
- `400 VALIDATION_ERROR` for a bad name.
`POST /auth/logout` (auth): revokes this session
`GET /me` (auth) · `PATCH /me` body `{ display_name? }` · `DELETE /me` (GDPR delete)
`GET /me/history` (auth): all picks, answers and points, newest first

### LATER (documented, not built in the MVP)
`POST /auth/kaleva/callback` body `{ code, state }` → finds or creates the user for that `kaleva` identity → `{ data: { token, user } }`
`POST /me/identities/kaleva` (auth) body `{ code, state }` → adds a `kaleva` identity to the current user. If it already belongs to another user, merges into that user (see `architecture.md` → Accounts) and returns a new `{ token, user }`.
- `409 IDENTITY_LINK_FAILED` if the merge fails (transaction rolled back)
`POST /auth/email/start` body `{ email, language, marketing_opt_in? }` → `202` always (never reveals if the email exists). Sends a 6-digit code, valid 10 min.
`POST /auth/email/verify` body `{ email, code }` → `{ data: { token, user } }`
- `400 CODE_INVALID`, `410 CODE_EXPIRED`, `429 TOO_MANY_ATTEMPTS` (5 tries per code; rate limit per email and IP)

## Games, teams, standings (step 2)
Response schemas live in `packages/shared_types/src/games.ts` (`game_summary`, `game_detail`, `game_day`, `standings_row`, `player_summary`, `team_summary`, `game_event`). Times are ISO UTC; "days" are Europe/Helsinki days. Every game and team has `data_source` (`liiga_api` | `demo`).
Caching: responses with a live game send `Cache-Control: no-store`; others `public, max-age=60` + `ETag` (304 on `If-None-Match`).
Errors: `404 GAME_NOT_FOUND`, `404 TEAM_NOT_FOUND`, `400 INVALID_DATE`, `400 RANGE_TOO_LARGE`, `400 VALIDATION_ERROR` (bad query values).

`GET /game_days/:date` (`YYYY-MM-DD` or `today`) → the hub. Order: live, then upcoming by start time, then final; `featured` games (`FEATURED_TEAM_EXTERNAL_ID`, default Kärpät) first in each group.
```json
{ "data": { "date": "2026-10-24", "demo_replay": false, "games": [
  { "id": "fab5…", "state": "upcoming", "featured": true, "start_time": "2026-10-24T14:00:00.000Z",
    "period": null, "game_clock_seconds": null, "home_goals": null, "away_goals": null, "ended_in": null,
    "home_team": { "name": "Kärpät", "city": "Oulu", "…": "…" }, "away_team": { "name": "KalPa" },
    "season": "2026-27", "data_source": "liiga_api" } ] } }
```
`GET /games?from=&to=&team_id=&state=` → `game_summary[]` by start time. Defaults: `from` = today, `to` = from + 6 days. At most 31 days apart.
```
GET /games?from=2026-10-20&to=2026-10-24&team_id=<uuid>&state=final
```
`GET /games/:game_id` → `game_detail`: summary + `events` in time order (goals with scorer + assists, penalties, derived `period_end`) with `score_after` on each goal.
```json
{ "data": { "home_goals": 5, "away_goals": 2, "state": "final", "ended_in": "regulation", "period": 3,
  "demo_replay": false, "events": [
    { "event_type": "goal", "period": 1, "game_time_seconds": 932, "player": { "first_name": "Wiktor", "last_name": "Nilsson" },
      "assists": [{ "last_name": "Rissanen" }], "score_after": { "home": 1, "away": 0 } },
    { "id": "period_end_1", "event_type": "period_end", "period": 1, "game_time_seconds": 1200, "score_after": null } ] } }
```
`GET /standings?season=2026-27` → latest snapshot (season optional), with `goal_difference` and `form` (last 5 finished real games, newest first: `W` | `OTW` | `OTL` | `L`).
```json
{ "data": { "season": "2026-27", "taken_at": "2026-10-24T11:34:12.607Z", "rows": [
  { "rank": 5, "team": { "name": "Kärpät" }, "games_played": 17, "points": 30, "goals_for": 50, "goals_against": 45,
    "goal_difference": 5, "form": ["W", "OTL", "OTW", "OTW", "OTL"] } ] } }
```
`GET /teams` → `team_summary[]` (Finnish alphabetical order).
`GET /teams/:team_id/players` → roster sorted by position (goalie, defense, forward) then jersey, for the scorer pick. Goals count real games only.
```json
{ "data": [{ "id": "…", "first_name": "…", "last_name": "…", "jersey_number": 10, "position": "forward",
  "birth_year": 2000, "season_goals": 3, "goals_last_5": 1 }] }
```

## Demo replay (judging)
Mounted only when `DEMO_REPLAY_ENABLED=true` (default everywhere except production). Replays ONE real finished game: the latest Kärpät game with goal events (else the featured demo game), plus the other finished games of that real day, all shifted so the featured game is "today" (`before` starts in 2 h, `live` started 75 min ago, `final` 3 h ago). Always `demo_replay: true` and `Cache-Control: no-store`.
- `before`: upcoming, no score, no events
- `live`: 2nd period 12:41 (or later, until both teams have a goal); only events up to then, score = goals shown
- `final`: real result and all events

`GET /demo/game_day?moment=before|live|final` → `game_day`
```json
{ "data": { "date": "2026-10-24", "demo_replay": true, "games": [
  { "state": "live", "featured": true, "home_team": { "name": "Kärpät" }, "away_team": { "name": "KalPa" },
    "home_goals": 2, "away_goals": 1, "period": 2, "game_clock_seconds": 1961 } ] } }
```
`GET /demo/games/:game_id?moment=…` → `game_detail` the same way (`404 GAME_NOT_FOUND` if the game is not finished).

## AI predictions
`GET /games/:game_id/ai_prediction`
```json
{ "data": {
  "predicted_winner_team_id": "…",
  "home_win_probability": 0.62,
  "reasons": [{ "fact_id": "f12", "text": "Kärpät won 4 of last 5 home games" }],
  "stakes": { "team_id": "…", "relegation_if_win": 0.27, "relegation_if_loss": 0.40 },
  "crowd": { "home_pick_share": 0.71, "total_picks": 3812 },
  "label_text": "AI's pick, calculated from game statistics"
} }
```

## Before-game predictions
`POST /games/:game_id/predictions` (auth) body `{ predicted_winner_team_id, predicted_home_goals, predicted_away_goals, predicted_scorer_id }`
- `409 PREDICTION_LOCKED` after puck drop · `409 PREDICTION_EXISTS` → use `PUT`
`PUT /games/:game_id/predictions` (auth): update before lock
`GET /me/predictions` (auth)

## Questions (live picks, result quiz, player vote)
`GET /games/:game_id/questions?phase=live|after` → open questions
`POST /questions/:question_id/answers` (auth) body `{ answer }` → `{ correct?, points_awarded, explanation? }`
- `409 QUESTION_LOCKED` · `409 ALREADY_ANSWERED`
- LATER: `GET /daily` → today's daily games + `today_points` and `daily_cap` (15); daily points above the cap recorded as 0

## Highlights
`GET /games/:game_id/highlight` → published highlight in the requested language, or `null`

## Leaderboard
`GET /leaderboard?period=week|season` → ranked users + `ai` + `crowd` rows
`GET /leaderboard/summary?period=week` → `{ ai_accuracy, humans_accuracy, crowd_accuracy }`

## Stories (published only)
`GET /games/:game_id/stories` → published stories with `label_text`
`POST /error_reports` body `{ target_type, target_id, description }`

## Admin (editor / admin)
**MVP (minimal editor form, step 7):**
`GET /admin/review/queue?traffic_light=yellow` → stories in review, with fact sheet + check result
`POST /admin/review/:story_id/decision` body `{ decision, edited_body?, notes? }`
`POST /admin/games/:game_id/highlight` (multipart: `video` file, or `video_url`) body `{ game_event_id, clip_credit }` → draft + timestamp check result
`PUT /admin/highlights/:highlight_id/texts/:language` body `{ headline, caption }` → runs `check_claims` (MVP: `fi`)
`POST /admin/highlights/:highlight_id/texts/:language/approve`
`POST /admin/highlights/:highlight_id/publish` body `{ rights_confirmed: true }`
- `422 RIGHTS_NOT_CONFIRMED` · `422 TIMESTAMP_MISMATCH` · `422 TEXT_NOT_APPROVED` (every published language must be approved)

**LATER (full admin app):**
`POST /admin/corrections` body `{ target_type, target_id, what_was_wrong, corrected_body }`
`GET /admin/review/stats` → approval rate, edit rate, review time, errors
`POST /admin/highlights/:highlight_id/texts/:language/ai_draft` → AI translation draft from the editor's text

## Jobs (internal / admin)
`POST /admin/jobs/sync_games` · `POST /admin/jobs/run_model` · `POST /admin/jobs/generate_stories/:game_id` · LATER: `POST /admin/jobs/generate_daily`
