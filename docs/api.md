# API (v1)

Base: `/api/v1`. JSON, snake_case fields.
Success: `{ "data": ... }`. Error: `{ "error": { "code": "GAME_NOT_FOUND", "message": "..." } }`.
Auth: `Authorization: Bearer <session_token>` from `POST /auth/email/verify`. Editor/admin routes need `role` editor or admin.
Language: `?lang=fi|sv|en`, else the user's `preferred_language`, else `Accept-Language`, else `fi`.

## Health
`GET /health` → `{ data: { status: "ok" } }`

## Auth (email + one-time code)
`POST /auth/email/start` body `{ email, language, marketing_opt_in? }` → `202` always (never reveals if the email exists). Sends a 6-digit code, valid 10 min.
`POST /auth/email/verify` body `{ email, code }` → `{ data: { token, user } }`
- `400 CODE_INVALID`, `410 CODE_EXPIRED`, `429 TOO_MANY_ATTEMPTS` (5 tries per code; rate limit per email and IP)
`POST /auth/logout` (auth): revokes this session
`GET /me` (auth) · `PATCH /me` body `{ display_name?, preferred_language? }` · `DELETE /me` (GDPR delete)
`GET /me/history` (auth): all picks, answers and points, newest first

## Games
`GET /games?status=scheduled&from=2026-10-24` → list
`GET /games/:game_id` → game + teams + score + events

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

## Questions (live picks, result quiz, daily games)
`GET /games/:game_id/questions?phase=live|after` → open questions
`GET /daily` → today's daily games + `today_points` and `daily_cap` (15)
`POST /questions/:question_id/answers` (auth) body `{ answer }` → `{ correct?, points_awarded, explanation? }`
- `409 QUESTION_LOCKED` · `409 ALREADY_ANSWERED` · daily points above the cap are recorded as 0

## Highlights
`GET /games/:game_id/highlight` → published highlight in the requested language, or `null`

## Leaderboard
`GET /leaderboard?period=week|season` → ranked users + `ai` + `crowd` rows
`GET /leaderboard/summary?period=week` → `{ ai_accuracy, humans_accuracy, crowd_accuracy }`

## Stories (published only)
`GET /games/:game_id/stories` → published stories with `label_text`
`POST /error_reports` body `{ target_type, target_id, description }`

## Admin (editor / admin)
`GET /admin/review/queue?traffic_light=yellow` → stories and questions in review, with fact sheet + check result
`POST /admin/review/:story_id/decision` body `{ decision, edited_body?, notes? }`
`POST /admin/corrections` body `{ target_type, target_id, what_was_wrong, corrected_body }`
`GET /admin/review/stats` → approval rate, edit rate, review time, errors

`POST /admin/games/:game_id/highlight` (multipart: `video` file, or `video_url`) body `{ game_event_id, clip_credit }` → draft + timestamp check result
`PUT /admin/highlights/:highlight_id/texts/:language` body `{ headline, caption }` → runs `check_claims`
`POST /admin/highlights/:highlight_id/texts/:language/ai_draft` → AI translation draft from the editor's text
`POST /admin/highlights/:highlight_id/texts/:language/approve`
`POST /admin/highlights/:highlight_id/publish` body `{ rights_confirmed: true }`
- `422 RIGHTS_NOT_CONFIRMED` · `422 TIMESTAMP_MISMATCH` · `422 TEXT_NOT_APPROVED` (every published language must be approved)

## Jobs (internal / admin)
`POST /admin/jobs/sync_games` · `POST /admin/jobs/run_model` · `POST /admin/jobs/generate_stories/:game_id` · `POST /admin/jobs/generate_daily`
