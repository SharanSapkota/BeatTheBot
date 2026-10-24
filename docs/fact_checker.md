# Fact Checker

Lives in `packages/fact_checker`. Pure functions, no DB, no network. Target ~100% test coverage.

## Terms
- **Fact sheet**: the list of verified facts for one game, built by code from Liiga data and model output.
- **Claim**: any checkable piece in AI text: a number, percentage, score, player name, team name, date or time.
- **Check result**: pass/fail plus the list of claims that did not match.

## 1. Fact sheet format
```json
{
  "game_id": "…",
  "built_at": "2026-10-24T21:47:00Z",
  "facts": [
    { "fact_id": "f1", "type": "final_score", "value": { "home": "Kärpät", "away": "Ilves", "home_goals": 3, "away_goals": 1 }, "source": "liiga_api" },
    { "fact_id": "f2", "type": "goal", "value": { "player": "Matias Maccelli", "team": "Kärpät", "period": 2, "time": "34:12" }, "source": "liiga_api" },
    { "fact_id": "f3", "type": "relegation_probability", "value": { "team": "Kärpät", "before": 0.34, "after": 0.21 }, "source": "prediction_model:v1" },
    { "fact_id": "f4", "type": "form", "value": { "team": "Kärpät", "home_wins_last_5": 4 }, "source": "derived" }
  ]
}
```
Rules: every fact has a `source`. Derived facts (form, streaks) are computed in code and unit tested.

## 2. `build_fact_sheet(game_data, model_output)`
- Input: game, events, standings and model output (already in DB).
- Output: a fact sheet. Never calls the LLM.

## 3. `check_claims(text, fact_sheet)`
1. **Extract claims** from text with rules (regex + lists):
   - numbers and percentages (`21 %`, `0.21`, `3–1`)
   - scores (`3–1`, `3-1`)
   - player and team names (match against the fact sheet name list + full player/team list)
   - dates and times
2. **Match each claim** to a fact:
   - Numbers: exact match. Percentages: rounded match (21 % = 0.21 ± 0.005).
   - Names: exact or known alias (`Kärpät` = `Oulun Kärpät`).
   - Any name of a real player/team **not in the fact sheet** = fail (stops invented players).
3. **Return**
```json
{ "passed": false, "claims_checked": 7, "failed_claims": [{ "claim": "4–1", "reason": "no matching score" }] }
```

## 4. What happens on fail
1. Regenerate with the failed claims listed in the prompt (max 2 retries).
2. Still failing → story goes to 🔴 red with the check result shown to the editor.

## 5. Known limits (say this honestly in the pitch)
- The checker catches **wrong facts**, not **unfair tone**. Tone is checked by humans (yellow/red review).
- Words like "dominant" or "crisis" are not facts. A banned-words list sends strong words to review.

## 6. Tests
- One test per claim type (pass + fail).
- Planted-error tests (see `reliability_testing.md`).
- Finnish characters (ä, ö) and name forms in Finnish grammar (e.g. "Kärppien" = Kärpät) are covered by the alias list.
