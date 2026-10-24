# Prediction Model (`poisson_mc_v1`)

Lives in `packages/prediction_model`. Pure TypeScript: no DB, no network, no LLM. Every number the app shows about the AI's pick comes from these functions. Fully unit tested (`pnpm --filter prediction_model test`), seeded random numbers (mulberry32), so every run can be repeated.

Items marked **VERIFY** are assumptions to confirm with Kaleva / Liiga.

## Terms
- **Team strength**: how good a team is at scoring (attack) and stopping goals (defence), compared to the league average (1.0).
- **Poisson distribution**: "how many times something happens". If we expect 3.1 goals, Poisson gives the chance of 0, 1, 2, 3 … goals.
- **Monte Carlo simulation**: play the rest of the season thousands of times with random results from the probabilities, then count outcomes (relegated in 2,100 of 10,000 runs = 21%).
- **Calibration**: when the model says 60%, does it happen about 60% of the time?
- **Brier score**: average of (probability − actual result)². 0 = perfect, 0.25 = coin flip. Lower is better.

## Season facts (`season_config.ts`)
| Fact | Value | Source |
|---|---|---|
| Season | 2026-27, 17 teams, one-off "superseason" | Kaleva brief |
| Points | regulation win 3, OT/SO win 2, OT/SO loss 1, regulation loss 0 | Liiga rules |
| Playoff spots | top 12 | Liiga standings `playoffsLines: [4, 12, 14]` — **VERIFY** meaning |
| Top spots | top 4 (straight to the quarter-finals) | same — **VERIFY** |
| Relegated | 3 (ranks 15–17, below line 14) | Kaleva brief + standings line 14 |
| Table order | points → goal difference → goals scored → random draw | **VERIFY**: Liiga's head-to-head tie-breakers are not modelled |

## Parameters (`model_config`)
| Parameter | Value | Why |
|---|---|---|
| `half_life_games` | 10 | a game 10 games back counts half |
| `prior_games` | 6 | strengths start as 6 league-average games (early season stays sane) |
| `prior_league_games` | 40 | league goal averages start from 40 default games |
| `default_home_goals` / `default_away_goals` | 3.0 / 2.6 | **VERIFY** against Liiga 2025-26 averages |
| `strength_iterations` | 5 | opponent-adjustment passes |
| `max_goals` | 10 per team | Poisson tail above is ~0 |
| `overtime_strength_weight` | 0.5 | half of the strength difference carries into OT |
| `season_simulations` / `stakes_simulations` | 10,000 / 5,000 | |
| `seed` | 2027 | stored in `model_runs.seed` |

## Steps
1. **60-minute score** (`team_strength.ts`): the final score of an OT/SO game includes the winning goal, so the 60-minute score was a tie one lower for the winner.
2. **League averages**: average 60-minute goals of home and away teams, blended with `prior_league_games` default games. Home advantage = home average / away average (measured, not assumed).
3. **Team strength**, opponent-adjusted, recent games weigh more (`weight = 0.5^(games back / 10)`):
   `attack = (Σ w·goals_for + P) / (Σ w·league_avg_at_venue·opponent_defence + P)`
   `defence = (Σ w·goals_against + P) / (Σ w·opponent_league_avg·opponent_attack + P)`
   where `P = prior_games × mean league goals` pulls teams with few games toward 1.0. Repeated 5 times, normalised to mean 1.0.
4. **Expected goals** (`game_probabilities.ts`):
   `home = league_home_avg × home_attack × away_defence`
   `away = league_away_avg × away_attack × home_defence`
5. **Game probabilities**: independent Poisson for each team over 60 minutes → home regulation win / tie / away regulation win. A tie goes to OT/SO, split `0.5 + 0.5 × (home_xg / (home_xg + away_xg) − 0.5)`. Returns `home_win`, `away_win` (incl. OT; they add up to 1), `overtime`, and the **predicted score** = the most likely 60-minute score in which the predicted winner wins.
6. **Season simulation** (`season_simulation.ts`): every remaining game becomes a table of outcomes (each 60-minute score; ties split into home/away OT wins with +1 goal for the winner) and is sampled with **one** random number. 10,000 runs, table ranked each run → playoff, top-4 and relegation probability per team, plus expected final points. One random number per game keeps runs with the same seed in step (common random numbers), so forcing one game changes only that game.
7. **Stakes** (`stakes.ts`): the simulation twice (5,000 runs, same seed) with the game forced to a home win and to an away win. Per team: playoff / top-4 / relegation "if win" vs "if lose". Shown: the biggest change per team, biggest first.
8. **Live win chance** (`live_win_chance.ts`): goals still to come in the remaining regulation time are Poisson with the pre-game expected goals × time left / 60 min; a tie at 60:00 uses the OT split; in OT a lead is final. Timeline: one point at puck drop, one after every goal, then "now" (live) or "end" at 100% / 0% (final).
9. **Top scorer pick** (`top_scorer_pick.ts`): on the predicted winner, the skater with the most goals in the team's last 5 games (team needs ≥ 3 games), then most season goals. **VERIFY**: no per-game line-ups are synced, so every rostered skater counts as having played those games.
10. **Reasons** (`reasons.ts`): facts, never free text. Types: `venue_record` (wins in last 5 home/away), `venue_scoring` (goals per game here vs other venue), `goals_for`, `goals_against` (vs league average), `scorer_form`, `head_to_head` (only when one team won every meeting), `streak` (≥ 3), `table_position`. Each = `{ fact_id, type, values, text_en }` from a fixed template; only included when the data supports it (enough games). Up to 3 that **favour the pick**, most relevant first (relevance = distance from an average team), one per type. Fewer than 3 if the data does not support more.
11. **`predict_game()`**: all of the above for one game from the history before its puck drop only.

## Output → DB (`apps/api/src/jobs/run_model.ts`)
- Runs in the background: on API start, after `sync:liiga`, and when live sync sees a game become final. One run at a time; requests during a run are merged into one follow-up run. It yields to the event loop between games so requests are answered meanwhile.
- `input_hash` = SHA-256 of model config, season games (status + score), players, goals and the 7-day window. Unchanged → skipped.
- Stores `model_runs` (version, season, seed, simulations, hash, duration), `team_season_odds` (all teams), `ai_predictions` for real games from the start of today (Helsinki) to 7 days ahead. Upcoming games are re-predicted when inputs change; a started game keeps its prediction; a started game without one is predicted from the data before its puck drop.
- Demo fill-in games are never predicted. The demo replay uses the same `predict_game()` on the replayed real game, from the data before its real puck drop.
- Measured 2026-10-24 on real data: 23 games + 17 teams in **≈ 6.8 s** (incl. remote DB), ≈ 0.3 s per game for stakes.

## Quality (see `reliability_testing.md`)
- Back-test (walk-forward) on Liiga 2025-26: **63.1%** winners right (always-home baseline 55.0%), Brier **0.2350** (baseline 0.2472).
- Known weaknesses: overtime under-predicted (~17% vs ~23% actual: independent Poisson gives too few ties); slightly over-confident above 70%; team strengths are treated as known in the season simulation, so odds near 0% / 100% are over-confident.
- Ideas for v2: draw inflation (or bivariate Poisson), strength uncertainty per simulation run, goalie data, real line-ups for the scorer pick.
