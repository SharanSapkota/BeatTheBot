# Fact Checker

Lives in `packages/fact_checker`. Pure functions, no DB, no network. Target ~100% test coverage.

## Terms
- **Fact sheet**: the list of verified facts for one game, built by code from Liiga data and model output. `kind` = `preview` | `summary`.
- **Claim**: any checkable piece in AI text: a number, percentage, score, date, time, ordinal, weekday, team or player name, or an unknown person-like name.
- **Check result**: every claim with its status (`verified` / `not_found` / `wrong`), plus tips and sensitive topics found.

## 1. Fact sheet format
Every fact has an id (`f1`, `f2`, …) and a `source`. Facts are built by code only and unit tested. (Examples below are illustrative; the exact shapes are the package types.)
```json
{
  "game_id": "…",
  "kind": "summary",
  "built_at": "2026-10-24T21:47:00Z",
  "facts": [
    { "fact_id": "f1", "type": "final_score", "value": { "home": "Kärpät", "away": "Ilves", "home_goals": 3, "away_goals": 1 }, "source": "liiga_api" },
    { "fact_id": "f2", "type": "goal", "value": { "player": "Matias Maccelli", "team": "Kärpät", "period": 2, "time": "34:12" }, "source": "liiga_api" },
    { "fact_id": "f3", "type": "season_odds", "value": { "team": "Kärpät", "kind": "relegation", "before": 0.34, "after": 0.21 }, "source": "prediction_model:v1" }
  ]
}
```

### Preview facts (`kind: preview`)
Built from data before puck drop, also for past games so demo replays have a preview.
| Type | Value | Notes |
|---|---|---|
| `form` | `{ team, results: "WWLWL", wins, losses, games }` | Last 5 finished games, oldest → newest |
| `head_to_head` | `{ home_team, away_team, date (YYYY-MM-DD), home_goals, away_goals, ended_in }` | One per meeting, last 5 meetings (any season), newest first |
| `home_away_record` | `{ team, venue: home \| away, wins, losses, games }` | This season; home team at home, away team away |
| `player_form` | `{ player, team, goals, games: 5 }` | Top scorer of each team in its last 5 games (only if goals > 0) |
| `table_position` | `{ team, rank, points, games_played }` | |
| `win_chance` | `{ home_team, away_team, home_win, away_win }` | source `prediction_model:<version>` |
| `stake` | `{ team, kind, if_win, if_loss }` | The biggest stake per team, source `prediction_model` |

### Summary facts (`kind: summary`, default)
`final_score`, `goal` (scorers), `winning_goal` `{ player, team, game_time }`, `standing` (rank/points before → after), `season_odds` (before → after), `next_game`.

The result quiz uses the latest `summary` sheet.

## 2. `classify_claims(text_with_ids, sheet, known_names)`
1. **Extract claims** with rules (regex + lists): numbers, percentages, scores (`3–1`, `3-1`), dates, times, ordinals, weekdays, team and player names (fact sheet names + `known_names` = full player/team list), and unknown person-like names.
2. **Classify each claim**:
   - `verified`: matches a fact; returned with the fact ids that support it.
   - `not_found`: not in the sheet, and its sentence cites no fact.
   - `wrong`: contradicts the sheet: a number / score / % / date in a sentence that cites fact ids but matches none of the sheet; a real player or team that is not in the sheet; an unknown person name (= invented player).
3. Matching: numbers exact; percentages rounded (21 % = 0.21 ± 0.005); names exact or a known alias (`Kärpät` = `Oulun Kärpät`).
```json
{ "claims": [
  { "claim": "3–1", "status": "verified", "fact_ids": ["f1"] },
  { "claim": "4th", "status": "not_found", "fact_ids": [] },
  { "claim": "Mikko Virtanen", "status": "wrong", "reason": "unknown person name" } ] }
```

## 3. `check_claims(text, sheet)`
Used by the result quiz. `passed` only when **every** claim is `verified`.

## 4. Tips and sensitive topics
- `find_tips(text)`: phrases that tip or predict a winner ("will win", "should beat", "favourite", "expect … to", "our tip", "bet", …). Any tip → 🔴.
- `find_escalation_words(text)`: injury, discipline, minors, legal (court, police, arrest, lawsuit), personal (illness, family, private life, divorce, pregnancy). Any hit → 🔴.

## 5. Traffic light from the result
- 🟢 every claim verified, no tip, no sensitive topic.
- 🟡 any `not_found` claim (or a story type not in the auto-publish list).
- 🔴 any `wrong` claim, a tip, a sensitive topic, or an LLM error.
Reasons are stored in `stories.check_result.traffic_light_reasons`. See `editorial_rules.md`.

## 6. What happens on fail
1. Regenerate with the failed claims listed in the prompt (max 2 retries).
2. Still failing → 🟡 or 🔴 with the claims shown to the editor next to the fact sheet on the `/editor` page.
3. An editor's edit re-runs the checker; any `wrong` claim → `422 CHECK_FAILED`.

## 7. Known limits (say this honestly in the pitch)
- The checker catches **wrong facts**, not **unfair tone**. Tone is checked by humans (yellow/red review) and by reader reports.
- Words like "dominant" or "crisis" are not facts. A banned-words list sends strong words to review.

## 8. Tests
- One test per claim type and status (`verified`, `not_found`, `wrong`).
- Tip and escalation phrase tests.
- Planted-error tests (see `reliability_testing.md`).
- Finnish characters (ä, ö) and name forms in Finnish grammar (e.g. "Kärppien" = Kärpät) are covered by the alias list.
