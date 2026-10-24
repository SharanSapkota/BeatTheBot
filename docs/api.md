# API (v1)

Base: `/api/v1`. JSON, snake_case fields.
Success: `{ "data": ... }`. Error: `{ "error": { "code": "GAME_NOT_FOUND", "message": "..." } }`.
Auth: **always** `Authorization: Bearer <session_token>` (no cookies), so the same API works in the PWA and in an embed on another domain. Token from `POST /auth/device` (MVP). Editor/admin routes need `role` editor or admin.
Language: `?lang=fi|sv|en`, else the user's `preferred_language`, else `Accept-Language`, else `fi`. MVP serves `fi` only.
Caching: the PWA caches only `GET` games, standings, "Data says", stories and leaderboard. `/auth/*` and `/me/*` are never cached.

## Health
`GET /health` → `{ data: { status: "ok" } }`

## Auth (MVP: device account, step 4)
Schemas: `packages/shared_types/src/accounts.ts`. Every request may send `Authorization: Bearer <token>`. No header = anonymous. A malformed, unknown, revoked or expired token = `401 UNAUTHORIZED` on **any** route (the web app then forgets the token and repeats a GET without it).
`POST /auth/device` body `{ display_name }` (1–30 chars, trimmed) → `201 { data: { token, user: { id, display_name, role } } }`
- Creates a `user` (role `user`), a `device` identity (random subject) and a 90-day session (only the token's SHA-256 is stored).
- `400 VALIDATION_ERROR` for a bad name · `429 RATE_LIMITED` after 20 sign-ins per IP per hour (in memory, per API process).
`POST /auth/logout` (auth) → `204`, revokes this session
`GET /me` (auth) → `{ id, display_name, role, total_points }` (`total_points` = sum of scored game picks and answers; election points are separate) · `PATCH /me` body `{ display_name? }` → same · `DELETE /me` → `204` (GDPR delete: the user, identities, sessions, picks, answers and election picks). All `no-store`.
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

## Data says (model output, step 3)
Schemas: `packages/shared_types/src/ai_predictions.ts`. Every number comes from `packages/prediction_model` (no LLM). The model output is shown only as neutral **"Data says"** info: no AI pick, no AI score, no AI scorer. Predictions are stored by the background model run (`jobs/run_model.ts`) for real games from the start of today to 7 days ahead; requests only read them.
Errors: `404 GAME_NOT_FOUND`, `404 PREDICTION_NOT_READY` (until the model ran for the game; calculated up to 7 days before puck drop), `409 GAME_NOT_STARTED` (win chance before puck drop), `404 ODDS_NOT_READY`.

`GET /games/:game_id/data_says` (replaces `/ai_prediction`) → the latest pre-game numbers (`public, max-age=60`). Live and final games keep their pre-game numbers.
```json
{ "data": {
  "game_id": "…",
  "home_win_probability": 0.669, "away_win_probability": 0.331, "overtime_probability": 0.164,
  "stakes": [{ "team_id": "…", "kind": "playoffs", "if_win": 0.473, "if_loss": 0.374 },
             { "team_id": "…", "kind": "top_4", "if_win": 0.379, "if_loss": 0.284 }],
  "crowd": { "total_picks": 48, "home_picks": 30, "away_picks": 18, "home_pick_share": 0.625 },
  "label_text": "Data says · calculated from Liiga data 14:49",
  "model_version": "poisson_mc_v1", "calculated_at": "2026-10-24T12:49:49.007Z"
} }
```
- `stakes`: the biggest change per team (`relegation` | `top_4` | `playoffs`), biggest first.
- `crowd`: same shape as `/crowd` below, `null` when nobody has picked.

`GET /games/:game_id/crowd` → the fans' split of before-game picks, or `null` (no picks). Used by the hub ("Fans: 62% Kärpät" / "Be the first to pick").
```json
{ "data": { "total_picks": 48, "home_picks": 30, "away_picks": 18, "home_pick_share": 0.625 } }
```

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

Demo replay (same model): `GET /demo/games/:game_id/data_says?moment=…` (the real pre-game numbers, from data before the replayed game's puck drop) and `GET /demo/games/:game_id/win_chance?moment=live|final` (timeline up to the replay moment; `before` → `409 GAME_NOT_STARTED`). Always `no-store`.

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
- Scoring: `jobs/score_predictions.ts` fills `points_awarded` (rules in `packages/scoring`: winner 10, exact score after 60 min 25, scorer 15, **bold call** +5 when the winner is right and fewer than 30% of fans picked that winner at puck drop, only with at least 20 picks) for finished games. Picks store `scoring_version` (current 2); the idempotent job re-scores every pick of a final game with a lower version (or never scored). It runs on API start, when live sync sees a final, after `sync:liiga` and after `db:seed`.
- Demo replay games: the web app keeps picks on the device (the replayed game is already over).

## Questions (step 6: live picks, result quiz, player vote)
Schemas: `packages/shared_types/src/questions.ts`. A game's questions are created the first time they are asked for (safe to repeat: `question_key` is unique per game).
`GET /games/:game_id/questions?phase=live|after` (auth optional, `no-store`) → the game's published questions
- `live` (while the game is live): `next_goal` (target = goals so far; options `home` | `away` | `none`; open 2 min from when first shown; locks when that goal is scored), `period_goal` (target 3; `yes` | `no`; locks when the 3rd period starts), `poll` (best player so far, 0 points).
- `after` (once final): up to 3 `result_quiz` questions built by code from the game's latest `summary` fact sheet (the AI summary's facts; only the score and goals if there is no summary yet). Options `a`–`d` with plausible wrong answers (other scorers, the odds before the game, nearby table places, nearby scores). Every text shown passes `check_claims`; a question that fails is saved as `in_review` and not shown. `player_vote`: the game's scorers first, then the best season scorers (option id = player id).
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
Schema: `packages/shared_types/src/leaderboard.ts`. Fans only: built from the current season's finished games and real users' scored picks and answers. No "Kaleva AI" row, no "All fans" row.
`GET /leaderboard?period=week|season` (default `week`; weeks run Monday–Sunday, Helsinki) → `public, max-age=60` anonymous, `private, no-store` when signed in
```json
{ "data": { "period": "week",
  "summary": { "you_accuracy": 0.64, "fans_accuracy": 0.58, "games_count": 32 },
  "prize": { "title": "Top 3: [Sponsor] gift card [€ value]", "note": "Winners by points. …" },
  "rows": [{ "rank": 1, "kind": "user", "display_name": "MikaK_Oulu", "points": 212, "movement": null },
           { "rank": 142, "kind": "you", "display_name": "…", "points": 121, "movement": 38 }] } }
```
- `summary.you_accuracy` / `fans_accuracy` = share of correct winner picks in the period (you vs all fans); `null` without picks (`you_accuracy` also when signed out). `games_count` = finished games in the period.
- Rows: top 10, plus the "you" row when it ranks lower. Equal points share a rank. `kind` = `user` | `you`. `movement` = places gained since the last game day (you only).

## Stories (step 5: AI preview + AI summary)
Schemas: `packages/shared_types`. Only `published` (or `corrected`) stories are returned.
`GET /games/:game_id/stories?type=preview|summary` → the published story, or `null` (the app shows "Preview coming soon" / "Summary coming soon")
```json
{ "data": { "id": "…", "story_type": "preview", "headline": "…", "body": "…",
  "bullets": ["…", "…", "…"],
  "label_text": "Written with AI from Liiga data · checked by Kaleva",
  "source": "llm",
  "last_meetings": [{ "date": "2026-09-30", "home_team": "KalPa", "away_team": "Kärpät", "home_goals": 2, "away_goals": 3 }],
  "correction": null,
  "published_at": "…" } }
```
- `bullets` (the 3 preview lines) and `last_meetings` are for previews. `source` = `llm` | `template` (template label: "Automatic preview from Liiga data" / "Automatic summary from Liiga data"). `correction` = `{ corrected_at, note }` when edited after publishing, else `null`.
- Demo replay: `GET /demo/games/:game_id/stories?type=&moment=` (preview at `before` / `live`, summary at `final`).

`POST /stories/:story_id/reports` (auth optional) body `{ reason }` → `201`
- Writes `error_reports` and `audit_log`, and sends the story back to 🟡 `in_review` (hidden until an editor approves it again).
- `429 RATE_LIMITED` after 10 reports per IP per hour.

## Editor (step 5)
Bearer token with `require_role('editor' | 'admin')`; otherwise `403 FORBIDDEN`. Every action writes `audit_log` (who, what, target, when, details).
`GET /editor/stories` → the queue: `in_review` stories (🟡 and 🔴), each with body, traffic light + reasons, claims (`verified` / `not_found` / `wrong`), the fact sheet facts and open reports.
`POST /editor/stories/:id/approve` → `published` (label with the time).
`POST /editor/stories/:id/edit` body `{ body }` → the fact checker re-runs; any `wrong` claim → `422 CHECK_FAILED` with the claims; otherwise published. A story that was published before becomes `corrected`, with a correction note + time (also in `corrections`).
`POST /editor/stories/:id/reject` body `{ note? }` → `rejected`.
- Make an editor: `pnpm --filter api make:editor -- --user_id <id>` (sets role `editor`, logged as `user.make_editor`).

## Elections (step 7)
Schemas: `packages/shared_types/src/elections.ts`. No AI. Only `published`, `closed` and `resulted` elections are visible to users (`draft` → `404 ELECTION_NOT_FOUND`). All `no-store` (the order and `my_pick` depend on the user).
`GET /elections?area=&status=` (auth optional) → `{ areas, elections }`. `areas` = every area with a visible election (for the filter chips; the app selects "Oulu" when it is there). `elections` = filtered by `area` (exact name) and `status` (`published` | `closed` | `resulted`); order: open polls by `poll_closes_at`, then not-yet-open, then closed / resulted (newest election first).
```json
{ "data": { "areas": ["Oulu"], "elections": [
  { "id": "…", "title": "Demo election", "election_type": "municipal", "area_type": "municipality", "area_name": "Oulu",
    "election_date": "2026-11-14", "poll_opens_at": "…", "poll_closes_at": "2026-11-14T18:00:00.000Z",
    "status": "published", "is_poll_open": true, "question_text": "Who will get the most votes in Oulu?",
    "is_demo": true, "candidate_count": 5 } ] } }
```
`GET /elections/:id` (auth optional) → the summary + `candidates` (random order per user: seeded by `user_id + election_id`; anonymous = new order per request) + `my_pick` (`{ candidate_id, points_awarded }` or `null`) + `winner_candidate_id` (once resulted).
```json
{ "data": { "id": "…", "title": "Demo election", "…": "…",
  "candidates": [{ "id": "…", "full_name": "Aino Esimerkki", "party_or_group": "Demo List A", "candidate_number": 12,
                   "short_bio": "Fictional demo candidate …", "photo_url": null }],
  "my_pick": { "candidate_id": "…", "points_awarded": null }, "winner_candidate_id": null } }
```
`POST /elections/:id/picks` (auth) body `{ candidate_id }` → `201` the pick · `PUT /elections/:id/picks` (auth) same body → `200` (change the pick)
```json
{ "data": { "election_id": "…", "candidate_id": "…", "points_awarded": null, "created_at": "…", "updated_at": "…" } }
```
- `409 POLL_CLOSED` at or after `poll_closes_at` (server clock) or when the election is closed / resulted · `409 POLL_NOT_OPEN` before `poll_opens_at` · `409 PICK_EXISTS` (POST twice → use `PUT`) · `404 PICK_NOT_FOUND` (PUT without a pick) · `400 INVALID_CANDIDATE` (not a candidate of this election) · `404 ELECTION_NOT_FOUND` · `401` without a token
`GET /elections/:id/results` (auth optional) → the share of picks per candidate, in the user's candidate order
```json
{ "data": { "election_id": "…", "total_picks": 31, "min_picks": 20, "hidden_reason": null,
  "shares": [{ "candidate_id": "…", "picks": 9, "share": 0.29 }],
  "winner_candidate_id": null,
  "label_text": "Not a scientific poll. Shows only the picks of Voita Kaleva users." } }
```
- `shares` is `null` with `hidden_reason` = `pick_first` (no pick yet and the poll is still open) or `not_enough_picks` (fewer than 20 picks: "Results show after 20 picks").

`GET /leaderboard/elections` (auth optional; `private, no-store` when signed in) → the election leaderboard (separate from games; no prizes)
```json
{ "data": { "elections_count": 1, "points_per_correct": 20,
  "rows": [{ "rank": 1, "kind": "user", "display_name": "Demo fan 03", "points": 20, "movement": null }] } }
```
- Rows: top 10 + the "you" row. Only resulted elections count.

## Rooms (step 9)
Schemas: `packages/shared_types/src/rooms.ts`. Every route needs a session (`401` without) and answers `no-store`. Rooms are private: room reads and writes by a non-member → `403 NOT_A_MEMBER`. Unknown or malformed ids → `404 ROOM_NOT_FOUND` / `QUESTION_NOT_FOUND`. Room points never count on `/leaderboard` or in `GET /me`.

`POST /rooms` body `{ name (3–40), topic (hockey | football | basketball | general_sports), question_interval_seconds (60 | 300 | 900 | 3600) }` → `201` the room detail (with `join_key`)
- `400 INVALID_INTERVAL` · `400 VALIDATION_ERROR` · `409 ROOM_LIMIT` (10 active rooms owned)
```json
{ "data": { "id": "…", "name": "Kärpät fans", "topic": "hockey", "status": "active", "is_demo": false,
  "question_interval_seconds": 300, "member_count": 1, "my_role": "owner", "my_rank": null, "my_points": 0,
  "join_key": "K7RP4T", "max_members": 100, "owner_id": "…", "created_at": "…",
  "members": [{ "user_id": "…", "display_name": "Mika", "role": "owner", "joined_at": "…", "is_me": true }] } }
```
`GET /me/rooms` → `[room summary]` (the detail without key and members; active rooms first). `my_rank` = all-time rank in the room, `null` while nobody has points.
`POST /rooms/join` body `{ key }` (spaces/dashes removed, upper-cased) → `200` the room detail (joining again is fine)
- `404 ROOM_NOT_FOUND` (no room with this key) · `409 ROOM_FULL` · `409 ROOM_CLOSED` · `429 RATE_LIMITED` after 10 tries per IP per minute
`GET /rooms/:id` → the room detail · `PATCH /rooms/:id` (owner) body `{ name?, question_interval_seconds? }` → the detail (a new interval starts after the current slot) · `POST /rooms/:id/regenerate_key` (owner, active room) → the detail with a new key · `POST /rooms/:id/close` (owner) → the detail (`status: "closed"`)
- `403 NOT_ROOM_OWNER` for members
`DELETE /rooms/:id/members/:user_id` → `204`: the owner removes a member, or a member leaves (own id)
- `403 NOT_ROOM_OWNER` (a member removing someone else) · `409 OWNER_CANNOT_LEAVE` (close the room instead) · `404 MEMBER_NOT_FOUND`

`GET /rooms/:id/current_question` → the open question of the current slot (created on the first request of the slot), or `null` in a closed room. No correct answer and no split while open.
```json
{ "data": { "question": { "id": "…", "room_id": "…", "slot_index": 12, "question_type": "trivia",
  "prompt": "Which city is Kärpät's home?", "options": [{ "id": "c", "label": "Rauma" }, { "id": "a", "label": "Oulu" }],
  "points": 3, "opens_at": "…", "locks_at": "…", "answer_count": 3, "my_answer": null, "seconds_left": 41, "member_count": 9 } } }
```
`GET /rooms/:id/questions?limit=20` (1–50) → past (locked) questions, newest first, with the reveal
```json
{ "data": [{ "id": "…", "prompt": "…", "options": ["…"], "question_type": "trivia", "points": 3, "answer_count": 8,
  "my_answer": "a", "correct_option": "a", "my_points": 3,
  "split": [{ "option_id": "c", "count": 2, "share": 0.25 }, { "option_id": "a", "count": 6, "share": 0.75 }],
  "right_names": ["Hanna H.", "Mika"],
  "reactions": [{ "emoji": "🔥", "count": 2, "mine": true }, { "emoji": "😂", "count": 0, "mine": false }] }] }
```
`POST /room_questions/:id/answers` body `{ option }` → `201 { question_id, option, answered_at }` (right/wrong and points show at the reveal)
- `409 QUESTION_LOCKED` (the slot is over) · `409 ALREADY_ANSWERED` · `409 ROOM_CLOSED` · `400 INVALID_ANSWER`
`POST /room_questions/:id/reactions` body `{ emoji }` (🔥 😂 😮 👏 😡) → `{ question_id, reactions }`; the same emoji again removes it (toggle)
`GET /rooms/:id/leaderboard?period=week|all` (default `week`, Mon–Sun Helsinki) → every member, revealed questions only
```json
{ "data": { "period": "week", "rows": [
  { "rank": 1, "kind": "you", "display_name": "Mika", "points": 21, "answers": 10, "correct_share": 0.86 } ] } }
```

## Admin (role `admin`)
Every `/admin/*` route uses `require_role('admin')`: `401` anonymous, `403 FORBIDDEN` for users and editors. Every change writes `audit_log` in the same transaction. Make an admin: `pnpm --filter api make:admin -- --user_id <id>` (logged as `user.make_admin`).

**Elections:**
`GET /admin/elections` → every election (drafts too) with candidates (fixed order: number, then name), `pick_count` and `result`
`POST /admin/elections` body `{ title, election_type, area_type, area_name, election_date, poll_opens_at, poll_closes_at, question_text?, is_demo? }` → `201` a `draft` (empty `question_text` → "Who will get the most votes in <area>?")
`GET /admin/elections/:id` · `PUT /admin/elections/:id` (same body; `draft` or `published` only) · `DELETE /admin/elections/:id` (`draft` only) → `204`
`POST /admin/elections/:id/candidates` body `{ full_name, party_or_group?, candidate_number?, short_bio, photo_url? }` → `201` · `PUT /admin/elections/:id/candidates/:candidate_id` (same body) · `DELETE /admin/elections/:id/candidates/:candidate_id` (`draft` only; a published election keeps at least 2) → `204`
`POST /admin/elections/:id/publish` (`draft` → `published`; needs at least 2 candidates) · `POST /admin/elections/:id/close` (`published` → `closed`; an early close moves `poll_closes_at` to now) · `POST /admin/elections/:id/result` body `{ winner_candidate_id, vote_counts? }` (`closed`, or `published` after `poll_closes_at`, or `resulted` to correct) → `resulted`; scores every pick (20 / 0) in the same transaction, idempotent
- `400 VALIDATION_ERROR` (title 1–120, area 1–80, `short_bio` ≤ 200, `photo_url` must be `https://`, `poll_opens_at` < `poll_closes_at` ≤ 20:00 Helsinki on `election_date`, vote counts ≥ 0 and only for this election's candidates) · `409 TOO_FEW_CANDIDATES` · `409 ELECTION_LOCKED` (change not allowed in this status) · `409 POLL_NOT_CLOSED` (result before the poll closed) · `400 INVALID_CANDIDATE` · `404 ELECTION_NOT_FOUND` · `404 CANDIDATE_NOT_FOUND`

**Highlights editor (step 12):**
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
