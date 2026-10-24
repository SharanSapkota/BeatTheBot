# Data Model (PostgreSQL, snake_case)

All tables have `id` (uuid, PK), `created_at` and `updated_at` unless noted. `external_id` = ID from the Liiga API. `language` is always `fi` | `sv` | `en`.

## Sports data (from Liiga sync)
**teams**: `external_id`, `name`, `short_name`, `city`, `logo_url`

**players**: `external_id`, `team_id` → teams, `first_name`, `last_name`, `jersey_number`, `position`, `birth_year`

**games**: `external_id`, `season`, `home_team_id`, `away_team_id`, `start_time`, `status` (`scheduled` | `live` | `final`), `home_goals`, `away_goals`, `ended_in` (`regulation` | `overtime` | `shootout`)

**game_events**: `game_id`, `event_type` (`goal` | `penalty` | `period_end` ...), `period`, `game_time_seconds`, `team_id`, `player_id`, `assist_player_ids` (uuid[]), `raw` (jsonb)

**standings_snapshots**: `season`, `taken_at`, `team_id`, `games_played`, `points`, `goals_for`, `goals_against`, `rank`

## Model output
**model_runs**: `run_at`, `model_version`, `simulations`, `input_hash`

**ai_predictions**: `game_id`, `model_run_id`, `home_win_probability`, `away_win_probability`, `predicted_winner_team_id`, `predicted_home_goals`, `predicted_away_goals`, `predicted_top_scorer_id`, `reasons` (jsonb: list of fact ids), `stakes` (jsonb)

**team_season_odds**: `model_run_id`, `team_id`, `playoff_probability`, `relegation_probability`

## Users and sign-in
**users**: `email` (unique, lowercased), `email_verified_at`, `display_name`, `preferred_language`, `role` (`player` | `editor` | `admin`), `is_subscriber`, `marketing_opt_in` (default false), `deleted_at`

**login_codes**: `email`, `code_hash` (never the plain code), `expires_at` (10 min), `attempt_count` (max 5), `used_at`, `ip_hash`

**sessions**: `user_id`, `token_hash`, `expires_at` (90 days), `last_used_at`, `user_agent`, `revoked_at`

## Games and points
**user_predictions** (before the game): `user_id`, `game_id`, `predicted_winner_team_id`, `predicted_home_goals`, `predicted_away_goals`, `predicted_scorer_id`, `points_awarded`, `scored_at`. Unique (`user_id`, `game_id`). Locked at `games.start_time`.

**questions** (live picks, result quiz, daily games): `game_id` (null for daily), `phase` (`live` | `after` | `daily`), `question_type` (`next_goal` | `period_goal` | `result_quiz` | `question_of_day` | `brain_calculator` | `higher_lower` | `quiz` | `player_vote` | `poll`), `prompt` (jsonb per language), `options` (jsonb), `correct_option` (null for votes/polls), `points`, `fact_ids` (jsonb), `opens_at`, `locks_at`, `status` (`draft` | `in_review` | `live` | `closed`)

**user_answers**: `user_id`, `question_id`, `answer`, `points_awarded`, `answered_at`. Unique (`user_id`, `question_id`).

**leagues** (later): `name`, `owner_user_id`, `invite_code` · **league_members** (later): `league_id`, `user_id`

## Editorial
**fact_sheets**: `game_id`, `facts` (jsonb: `[{ fact_id, type, value, source }]`), `built_at`

**stories**: `game_id`, `story_type` (`what_it_means` | `ai_pick_reasons` | `recap`), `language`, `body`, `fact_sheet_id`, `traffic_light` (`green` | `yellow` | `red`), `status` (`draft` | `in_review` | `published` | `rejected` | `corrected`), `check_result` (jsonb), `generation_attempts`, `prompt_version`, `published_at`, `label_text`

**story_reviews**: `story_id`, `editor_user_id`, `decision` (`approve` | `edit` | `reject`), `edited_body`, `notes`, `reviewed_at`

**highlights**: `game_id`, `game_event_id`, `video_url`, `duration_seconds`, `clip_credit`, `rights_confirmed_by`, `rights_confirmed_at`, `timestamp_check_passed`, `status` (`draft` | `published` | `corrected` | `removed`), `published_by`, `published_at`

**highlight_texts**: `highlight_id`, `language`, `headline`, `caption`, `source` (`editor` | `ai_translation`), `check_result` (jsonb), `approved_by`, `approved_at`. Unique (`highlight_id`, `language`).

**error_reports**: `target_type` (`story` | `highlight` | `question`), `target_id`, `reported_by`, `description`, `status` (`open` | `fixed` | `invalid`), `fixed_at`

**corrections**: `target_type`, `target_id`, `what_was_wrong`, `corrected_at`, `corrected_by`

## Views
**leaderboard_view**: points per user per week/season (predictions + answers, daily capped at 15/day), plus AI and Crowd as pseudo-players.

## Indexes
- `games(start_time)`, `games(status)`, `game_events(game_id)`
- `user_predictions(game_id)`, `user_answers(question_id)`, `user_answers(user_id)`
- `login_codes(email, expires_at)`, `sessions(token_hash)`
- `stories(status, traffic_light)`, `highlights(game_id, status)`
