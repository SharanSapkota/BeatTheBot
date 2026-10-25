# Data Model (PostgreSQL, snake_case)

All tables have `id` (uuid, PK), `created_at` and `updated_at` unless noted. `external_id` = ID from the Liiga API. `language` is always `fi` | `sv` | `en` (MVP uses `fi` only).

## Sports data (from Liiga sync)
Every sports-data table (`teams`, `players`, `games`, `game_events`, `standings_snapshots`) also has `data_source` (`liiga_api` | `admin` | `demo`; `admin` = a football / basketball match an admin entered, step 8). Real Liiga data first; `demo` rows only fill gaps and are never written over `liiga_api` rows.

**leagues** (step 8, migration `0012_sport_categories`; reference rows with fixed ids, kept by `truncate_all_tables`): `key` (unique), `name`, `sport` (`hockey` | `football` | `basketball`), `country` (default `FI`), `data_source`. Rows: Liiga (hockey, `liiga_api`, the default league), Veikkausliiga (football, `admin`), Korisliiga (basketball, `admin`). Unique (`id`, `sport`), so teams and games reference (`league_id`, `sport`) and their sport always matches the league. Adding a sport = one entry in `SPORTS` (`packages/scoring`) + the `sport` CHECK in a new migration.

**teams**: `external_id`, `name`, `short_name`, `city`, `logo_url`, `sport` (default `hockey`), `league_id` (default Liiga)

**players**: `external_id`, `team_id` → teams, `first_name`, `last_name`, `jersey_number`, `position`, `birth_year`

**games**: `external_id`, `season`, `home_team_id`, `away_team_id`, `start_time`, `status` (`scheduled` | `live` | `final`), `home_goals`, `away_goals`, `ended_in` (`regulation` | `overtime` | `shootout`), `period` (current period while live, last period when final), `game_clock_seconds` (seconds since game start, live only), `sport` (default `hockey`), `league_id` (default Liiga), `top_scorer_player_id` (basketball: the player with the most points, entered with the result). Index (`sport`, `start_time`). The API shows `status` as `state`: `upcoming` | `live` | `final`.

**game_events**: `game_id`, `event_type` (`goal` | `penalty` | `period_end` ...), `period`, `game_time_seconds`, `team_id`, `player_id`, `assist_player_ids` (uuid[]), `raw` (jsonb)

**standings_snapshots**: `season`, `taken_at`, `team_id`, `games_played`, `points`, `goals_for`, `goals_against`, `rank`

## Model output
Shown in the app only as "Data says" (win chance + stakes). The pick, score and scorer columns of `ai_predictions` are not shown any more.

**model_runs**: `run_at`, `model_version`, `season`, `simulations`, `seed`, `input_hash` (indexed; an unchanged hash skips the run), `duration_ms`

**ai_predictions**: `game_id` (indexed), `model_run_id`, `home_win_probability`, `away_win_probability`, `overtime_probability`, `expected_home_goals`, `expected_away_goals`, `overtime_home_share` (the last three drive the live win chance), `predicted_winner_team_id`, `predicted_home_goals`, `predicted_away_goals`, `predicted_top_scorer_id`, `predicted_top_scorer_form` (jsonb `{ recent_goals, recent_games, season_goals }`), `reasons` (jsonb: `[{ fact_id, type, team_id, values, text_en, relevance, favours_team_id }]`), `stakes` (jsonb: `{ highlights, all }` of `{ team_id, kind, if_win, if_loss }`). The API returns the newest one per game.

**team_season_odds**: `model_run_id`, `team_id`, `playoff_probability`, `top_spots_probability`, `relegation_probability`, `expected_points`

## Users and accounts
Designed for account linking: a user is the person, identities are the ways they sign in. See `architecture.md` → Accounts.

**users**: `display_name`, `role` (`user` | `editor` | `admin`, default `user`; `player` was renamed to `user` in `0011_elections`), `email` (nullable, lowercased; contact only), `preferred_language` (default `fi`), `is_subscriber` (default false), `deleted_at`. **No login data in `users`.**

**auth_identities**: `user_id` → users, `provider` (`device` | `email` | `kaleva`), `provider_subject` (device: random id; email: lowercased email; kaleva: OIDC `sub`), `created_at`, `last_used_at`. Unique (`provider`, `provider_subject`). One user can have many identities. MVP creates only `device`.

**sessions**: `user_id`, `token_hash` (SHA-256 of a random 32-byte token; the plain token is never stored), `expires_at` (90 days), `last_used_at`, `user_agent`, `revoked_at`

**login_codes** (LATER, email OTP): `email`, `code_hash` (never the plain code), `expires_at` (10 min), `attempt_count` (max 5), `used_at`, `ip_hash`. `marketing_opt_in` (default false) is added to `users` with it.

## Games and points
**user_predictions** (before the game): `user_id`, `game_id`, `predicted_winner_team_id` (nullable since `0012`: null = a football draw pick), `predicted_home_goals`, `predicted_away_goals` (nullable: basketball has no exact score), `predicted_scorer_id` (basketball: the top scorer pick), `predicted_margin_band` (`1_5` | `6_10` | `11_plus`, basketball), `points_awarded`, `scored_at`, `scoring_version` (int, default 1; current rules = 2; the scoring job re-scores final games' picks with a lower version). Unique (`user_id`, `game_id`). Locked at `games.start_time`.

**questions** (live picks, result quiz, player vote; daily games LATER): `game_id` (null for daily, later), `phase` (`live` | `after`; `daily` later), `question_type` (MVP: `next_goal` | `period_goal` | `result_quiz` | `player_vote` | `poll`; later: `question_of_day` | `brain_calculator` | `higher_lower` | `quiz`), `question_key` (e.g. `next_goal:2`, `period_goal:3`, `result_quiz:1`, `player_vote`, `poll`; unique per `game_id`, so creating questions on the first request is safe to repeat), `target` (next_goal: goals scored when it opened; period_goal: the period), `prompt` (jsonb per language), `options` (jsonb `[{ id, label }]`), `correct_option` (quiz: set when created; live picks: set by `score_answers` once decided; null for votes/polls), `explanation` (jsonb per language `{ right, wrong }`, quiz only), `points`, `fact_ids` (jsonb), `opens_at`, `locks_at`, `status` (`draft` | `in_review` (failed the fact check, not shown) | `live` | `closed` (decided))

**user_answers**: `user_id`, `question_id`, `answer` (option id), `points_awarded` (null until the question is decided), `answered_at`. Unique (`user_id`, `question_id`): one answer per question. Real games only; demo replay answers stay on the device.

**private_leagues** (later; the never-used `leagues` table, renamed in `0012`): `name`, `owner_user_id`, `invite_code` · **private_league_members** (later): `league_id`, `user_id`

## Rooms (step 9, migration `0013_rooms`)
Room points never count on the global leaderboard. Rules: `architecture.md` → Rooms.

**rooms**: `name` (CHECK 3–40 chars), `topic` (`hockey` | `football` | `basketball` | `general_sports`), `join_key` (unique; generated keys use the alphabet without 0/O/1/I/L), `owner_id` → users (cascade), `question_interval_seconds` (> 0; the API allows 60 | 300 | 900 | 3600), `max_members` (default 100), `status` (`active` | `closed`, default `active`), `is_demo` (default false), `schedule_started_at` + `slot_base` (slot = `slot_base + floor((now − schedule_started_at) / interval)`; start = `created_at`, 0). Index `owner_id`.

**room_members**: `room_id` → rooms (cascade), `user_id` → users (cascade), `role` (`owner` | `member`), `joined_at`. Unique (`room_id`, `user_id`). Index `user_id`.

**room_questions**: `room_id` → rooms (cascade), `slot_index`, `question_type` (`trivia` | `opinion`), `prompt`, `options` (jsonb `[{ id, label }]` in the shown order), `correct_option` (null exactly for opinion questions, CHECK), `points` (trivia 3, opinion 1), `opens_at`, `locks_at`, `source` (`mock` | `llm`). Unique (`room_id`, `slot_index`): the current question is created on the first request of its slot.

**room_answers**: `question_id` → room_questions (cascade), `user_id` → users (cascade), `option`, `points_awarded` (set when saved, shown after the reveal). Unique (`question_id`, `user_id`). Index `user_id`.

**room_reactions** (no `updated_at`): `question_id` → room_questions (cascade), `user_id` → users (cascade), `emoji` (🔥 😂 😮 👏 😡), `created_at`. Unique (`question_id`, `user_id`, `emoji`); posting the same emoji again removes it.

## Elections (step 7, migration `0011_elections`)
No AI data here. Fairness rules: `architecture.md` → Elections.

**elections**: `title`, `election_type` (`parliamentary` | `municipal` | `presidential` | `county` | `other`), `area_type` (`country` | `electoral_district` | `municipality`), `area_name`, `election_date` (date), `poll_opens_at`, `poll_closes_at` (timestamptz; CHECK `poll_opens_at < poll_closes_at`; the API also checks `poll_closes_at` ≤ 20:00 Helsinki on `election_date`), `status` (`draft` | `published` | `closed` | `resulted`, default `draft`), `question_text` (default "Who will get the most votes in <area>?"), `is_demo` (default false), `created_by` → users (set null). Index (`status`, `poll_closes_at`).

**election_candidates**: `election_id` → elections (cascade), `full_name`, `party_or_group` (nullable), `candidate_number` (nullable int), `short_bio` (max 200 chars, CHECK; written by the admin), `photo_url` (nullable, CHECK `https://`). Index `election_id`.

**election_picks**: `user_id` → users (cascade: deleting a user deletes their picks), `election_id` → elections (cascade), `candidate_id` → election_candidates (restrict), `points_awarded` (null until the result; 20 or 0), `scored_at`, `created_at`, `updated_at`. Unique (`user_id`, `election_id`). Index (`election_id`, `candidate_id`). Only the prediction is stored, never a vote intention.

**election_results** (one per election, no `updated_at`): `election_id` (unique) → elections (cascade), `winner_candidate_id` → election_candidates, `vote_counts` (jsonb `{ <candidate_id>: votes }`, nullable), `entered_by` → users (set null), `entered_at`. Entering the result again replaces the row and re-scores the picks.

## Editorial
Migration `0010_fans_vs_fans` (step 5) adds the story types, `stories.source` / correction columns, `fact_sheets.kind`, `user_predictions.scoring_version` and `audit_log`.

**fact_sheets**: `game_id`, `kind` (`preview` | `summary`, default `summary`), `facts` (jsonb: `[{ fact_id, type, value, source }]`; `source` = `liiga_api` | `sample_data` | `derived` | `prediction_model:…`), `built_at`, `input_hash` (step 10, migration `0014_story_input_hash`: SHA-256 of the facts + prompt and template versions; an unchanged hash means no new story and no LLM call). Index (`game_id`, `kind`). The result quiz uses the latest `summary` sheet. Fact types: `final_score`, `goal`, `winning_goal`, `standing`, `season_odds`, `next_game`, `lead_changes` (step 10), `form` (with `draws`), `head_to_head`, `season_series` (step 10), `home_away_record` (with `draws`), `player_form`, `table_position`, `win_chance`, `stake`.

**stories** (every sport since step 10; demo hockey games get none): `game_id`, `story_type` (`preview` | `summary`; old `what_it_means` rows become `summary`; older values `ai_pick_reasons` | `recap` are not generated), `language`, `body`, `fact_sheet_id`, `source` (`llm` | `template`), `traffic_light` (`green` | `yellow` | `red`), `status` (`draft` | `in_review` | `published` | `rejected` | `corrected`), `check_result` (jsonb: claims + `traffic_light_reasons`), `generation_attempts`, `prompt_version`, `published_at`, `label_text`, `corrected_at`, `correction_note`

**story_reviews**: `story_id`, `editor_user_id`, `decision` (`approve` | `edit` | `reject`), `edited_body`, `notes`, `reviewed_at`

**highlights**: `game_id`, `game_event_id`, `video_url`, `duration_seconds`, `clip_credit`, `rights_confirmed_by`, `rights_confirmed_at`, `timestamp_check_passed`, `status` (`draft` | `published` | `corrected` | `removed`), `published_by`, `published_at`

**highlight_texts**: `highlight_id`, `language`, `headline`, `caption`, `source` (`editor` | `ai_translation`), `check_result` (jsonb), `approved_by`, `approved_at`. Unique (`highlight_id`, `language`).

**error_reports**: `target_type` (`story` | `highlight` | `question`), `target_id`, `reported_by`, `description`, `status` (`open` | `fixed` | `invalid`), `fixed_at`

**corrections**: `target_type`, `target_id`, `what_was_wrong`, `corrected_at`, `corrected_by`

**audit_log** (no `updated_at`): `actor_user_id` (null = system), `action` (e.g. `story.approve`, `story.edit`, `story.reject`, `story.report`, `user.make_editor`, `user.make_admin`, `election.create`, `election.update`, `election.delete`, `election.publish`, `election.close`, `election.result`, `candidate.create`, `candidate.update`, `candidate.delete`), `target_type`, `target_id`, `details` (jsonb), `created_at`

## Leaderboard (no view)
Fans only. Computed in `modules/leaderboard` from finished games and real users' `user_predictions.points_awarded` (scored with `packages/scoring`, incl. the bold call), per week (Mon–Sun, Helsinki) or season. No AI row. Answers (step 6) and the daily cap of 15/day (later) are added there. A `leaderboard_view` can replace it if the data grows.

## Indexes
- `games(start_time)`, `games(status)`, `game_events(game_id)`
- `user_predictions(game_id)`, `user_answers(question_id)`, `user_answers(user_id)`
- `auth_identities(provider, provider_subject)` unique, `auth_identities(user_id)`, `sessions(token_hash)`, `sessions(user_id)`
- Later: `login_codes(email, expires_at)`
- `stories(status, traffic_light)`, `highlights(game_id, status)`
