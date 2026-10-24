# API (v1)

Base: `/api/v1`. JSON, snake_case fields.
Success: `{ "data": ... }`. Error: `{ "error": { "code": "GAME_NOT_FOUND", "message": "..." } }`.
Auth: **always** `Authorization: Bearer <session_token>` (no cookies), so the same API works in the PWA and in an embed on another domain. Token from `POST /auth/device` (MVP). Editor/admin routes need `role` editor or admin.
Language: `?lang=fi|sv|en`, else the user's `preferred_language`, else `Accept-Language`, else `fi`. MVP serves `fi` only.
Caching: the PWA caches only `GET` games, standings, AI predictions and leaderboard. `/auth/*` and `/me/*` are never cached.

## Health
`GET /health` → `{ data: { status: "ok" } }`

## Auth (MVP: device account, step 4)
Schemas: `packages/shared_types/src/accounts.ts`. Every request may send `Authorization: Bearer <token>`. No header = anonymous. A malformed, unknown, revoked or expired token = `401 UNAUTHORIZED` on **any** route (the web app then forgets the token and repeats a GET without it).
`POST /auth/device` body `{ display_name }` (1–30 chars, trimmed) → `201 { data: { token, user: { id, display_name, role } } }`
- Creates a `user` (role `player`), a `device` identity (random subject) and a 90-day session (only the token's SHA-256 is stored).
- `400 VALIDATION_ERROR` for a bad name · `429 RATE_LIMITED` after 20 sign-ins per IP per hour (in memory, per API process).
`POST /auth/logout` (auth) → `204`, revokes this session
`GET /me` (auth) → `{ id, display_name, role, total_points }` (`total_points` = sum of scored picks) · `PATCH /me` body `{ display_name? }` → same · `DELETE /me` → `204` (GDPR delete: the user, identities, sessions, picks and answers). All `no-store`.
- `GET /me/history` (all picks, answers and points) is postponed until a screen needs it.

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

## AI predictions (step 3)
Schemas: `packages/shared_types/src/ai_predictions.ts`. Every number comes from `packages/prediction_model` (no LLM). Predictions are stored by the background model run (`jobs/run_model.ts`) for real games from the start of today to 7 days ahead; requests only read them.
Errors: `404 GAME_NOT_FOUND`, `404 PREDICTION_NOT_READY` ("The AI has not made its pick for game … yet. Picks are calculated up to 7 days before puck drop."), `409 GAME_NOT_STARTED` (win chance before puck drop), `404 ODDS_NOT_READY`.

`GET /games/:game_id/ai_prediction` → the latest pre-game pick (`public, max-age=60`). Live and final games keep their pre-game pick.
```json
{ "data": {
  "game_id": "…", "predicted_winner_team_id": "…",
  "home_win_probability": 0.669, "away_win_probability": 0.331, "overtime_probability": 0.164,
  "predicted_home_goals": 3, "predicted_away_goals": 2,
  "predicted_scorer": { "id": "…", "team_id": "…", "first_name": "Eetu", "last_name": "Päkkilä", "jersey_number": 82,
                        "recent_goals": 2, "recent_games": 5, "season_goals": 6 },
  "reasons": [{ "fact_id": "venue_record:home:<team_id>", "type": "venue_record",
                "values": { "team": "Kärpät", "venue": "home", "wins": 5, "games": 5 },
                "text_en": "Kärpät won 5 of their last 5 home games." }],
  "stakes": [{ "team_id": "…", "kind": "playoffs", "if_win": 0.473, "if_loss": 0.374 },
             { "team_id": "…", "kind": "top_4", "if_win": 0.379, "if_loss": 0.284 }],
  "crowd": null,
  "label_text": "AI's pick, calculated from game statistics",
  "model_version": "poisson_mc_v1", "calculated_at": "2026-10-24T12:49:49.007Z"
} }
```
- `reasons`: up to 3 facts that support the pick, most relevant first. `stakes`: the biggest change per team (`relegation` | `top_4` | `playoffs`), biggest first.
- `crowd`: from `user_predictions` (`{ home_pick_share, total_picks }`), `null` when nobody has picked (the app shows "Be the first to pick").

`GET /games/:game_id/win_chance` → home win chance timeline for a live or final game (`no-store` while live).
```json
{ "data": { "game_id": "…", "state": "live", "model_version": "poisson_mc_v1", "updated_at": "…",
  "points": [
    { "kind": "start", "game_time_seconds": 0, "home_goals": 0, "away_goals": 0, "home_win_probability": 0.63 },
    { "kind": "goal", "game_time_seconds": 932, "home_goals": 1, "away_goals": 0, "home_win_probability": 0.79 },
    { "kind": "now", "game_time_seconds": 1961, "home_goals": 2, "away_goals": 1, "home_win_probability": 0.82 } ] } }
```
Final games end with `{ "kind": "end", "home_win_probability": 1 | 0 }`. Shootout attempts are not goals here.

`GET /standings/odds` → latest season simulation (10,000 runs), most expected points first.
```json
{ "data": { "season": "2026-27", "model_version": "poisson_mc_v1", "simulations": 10000, "calculated_at": "…",
  "rows": [{ "team": { "name": "SaiPa" }, "playoff_probability": 1.0, "top_4_probability": 0.829,
             "relegation_probability": 0.0, "expected_points": 119.8 }] } }
```

Demo replay (same model): `GET /demo/games/:game_id/ai_prediction?moment=…` (the real pre-game pick, from data before the replayed game's puck drop) and `GET /demo/games/:game_id/win_chance?moment=live|final` (timeline up to the replay moment; `before` → `409 GAME_NOT_STARTED`). Always `no-store`.

## Before-game predictions (step 4)
Schemas: `packages/shared_types/src/predictions.ts`. One pick per user and game, editable until puck drop.
`POST /games/:game_id/predictions` (auth) body `{ predicted_winner_team_id, predicted_home_goals, predicted_away_goals, predicted_scorer_id | null }` (goals 0–20) → `201` the saved pick
`PUT /games/:game_id/predictions` (auth): same body, changes the pick → `200`
```json
{ "data": { "game_id": "…", "predicted_winner_team_id": "…", "predicted_home_goals": 3, "predicted_away_goals": 2,
  "predicted_scorer_id": "…", "points_awarded": null, "created_at": "…", "updated_at": "…" } }
```
- `409 PREDICTION_LOCKED` at/after `start_time` · `409 PREDICTION_EXISTS` (POST twice → use `PUT`) · `404 PREDICTION_NOT_FOUND` (PUT without a pick) · `404 GAME_NOT_FOUND` · `400 INVALID_PICK` (winner not one of the two teams, scorer not on either roster) · `400 VALIDATION_ERROR`
`GET /me/predictions?game_id=` (auth, `no-store`) → the user's picks, newest game first (one game with `game_id`)
- Scoring: `jobs/score_predictions.ts` fills `points_awarded` (rules in `packages/scoring`: winner 10, exact score after 60 min 25, scorer 15, +5 when right and the AI was wrong) for finished games. It runs on API start, when live sync sees a final, after `sync:liiga` and after `db:seed`.
- Demo replay games: the web app keeps picks on the device (the replayed game is already over).

## Questions (step 6: live picks, result quiz, player vote)
Schemas: `packages/shared_types/src/questions.ts`. A game's questions are created the first time they are asked for (safe to repeat: `question_key` is unique per game).
`GET /games/:game_id/questions?phase=live|after` (auth optional, `no-store`) → the game's published questions
- `live` (while the game is live): `next_goal` (target = goals so far; options `home` | `away` | `none`; open 2 min from when first shown; locks when that goal is scored), `period_goal` (target 3; `yes` | `no`; locks when the 3rd period starts), `poll` (best player so far, 0 points).
- `after` (once final): up to 3 `result_quiz` questions built by code from the game's fact sheet (the "what it means" facts; only the score and goals if there is no story yet). Options `a`–`d` with plausible wrong answers (other scorers, the odds before the game, nearby table places, nearby scores). Every text shown passes `check_claims`; a question that fails is saved as `in_review` and not shown. `player_vote`: the game's scorers first, then the best season scorers (option id = player id).
```json
{ "data": [{ "id": "…", "game_id": "…", "phase": "after", "question_type": "result_quiz",
  "prompt": "Who scored the first goal of the game?", "options": [{ "id": "a", "label": "Eetu Laine" }, …],
  "points": 2, "target": null, "opens_at": "…", "locks_at": "…", "is_locked": false,
  "correct_option": null, "explanation": null, "my_answer": null, "shares": null }] }
```
- `correct_option` and `explanation` (`{ right, wrong }`) are shown once the question is decided and the user has answered (or it is locked). `my_answer` = `{ answer, points_awarded }` for the signed-in user. `shares` (poll and vote) = share of all answers per option, shown after answering.

`POST /questions/:question_id/answers` (auth) body `{ answer }` (an option id) → `201`
```json
{ "data": { "question_id": "…", "answer": "b", "correct": true, "points_awarded": 2, "correct_option": "b", "explanation": "Correct! …" } }
```
- Points (`packages/scoring`): next goal 5, period goal 3, quiz 2 each, vote 1, poll 0. Quiz and vote answers are scored at once. Live picks have `points_awarded: null` until `jobs/score_answers.ts` decides them. That job is idempotent and runs on API start, after every live sync update, when a game ends and after `sync:liiga`. Answer points count on the leaderboard and in `GET /me`.
- `409 QUESTION_LOCKED` · `409 ALREADY_ANSWERED` (one answer per question) · `400 INVALID_ANSWER` (not one of the options) · `404 QUESTION_NOT_FOUND` · `404 GAME_NOT_FOUND` · `401` without a token
- Demo replay: `GET /demo/games/:game_id/questions?phase=live|after&moment=before|live|final` → the same questions for the replay moment, built in memory (ids `demo_<game_id>_<key>`, right answers included, never saved). Demo answers stay on the device and never reach the leaderboard.
- LATER: `GET /daily` → today's daily games + `today_points` and `daily_cap` (15); daily points above the cap recorded as 0

## Highlights
`GET /games/:game_id/highlight` → published highlight in the requested language, or `null`

## Leaderboard (step 4)
Schema: `packages/shared_types/src/leaderboard.ts`. Built from the current season's finished games, scored picks and the AI's own pre-game picks (the AI is ranked like a player with its own points).
`GET /leaderboard?period=week|season` (default `week`; weeks run Monday–Sunday, Helsinki) → `public, max-age=60` anonymous, `private, no-store` when signed in
```json
{ "data": { "period": "week",
  "accuracy": { "you": 0.64, "ai": 0.61, "fans": 0.58 },
  "fans_beat_ai_weeks": 3, "compared_weeks": 5, "game_count": 32,
  "prize": { "title": "Top 3: [Sponsor] gift card [€ value]", "note": "Winners by points. …" },
  "rows": [{ "rank": 1, "kind": "user", "display_name": "MikaK_Oulu", "points": 212, "movement": null },
           { "rank": 7, "kind": "ai", "display_name": "Kaleva AI", "points": 176, "movement": null },
           { "rank": 142, "kind": "you", "display_name": "…", "points": 121, "movement": 38 }] } }
```
- `accuracy` = share of correct winner picks in the period; `null` without picks (`you` also when signed out). `fans_beat_ai_weeks` of the last `compared_weeks` (max 5) full weeks with both AI and fan picks. `game_count` = finished games with an AI pick.
- Rows: top 10, plus the AI and the "you" row when they rank lower. Equal points share a rank; users before the AI on a tie. `movement` = places gained since the last game day (you only).
- The separate `/leaderboard/summary` is not needed: `accuracy` covers it.

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
`POST /admin/jobs/sync_games` · `POST /admin/jobs/run_model` (not built; for now `pnpm --filter @voita_kone/api model:run`, and `sync:liiga` runs the model after syncing) · `POST /admin/jobs/generate_stories/:game_id` · LATER: `POST /admin/jobs/generate_daily`
