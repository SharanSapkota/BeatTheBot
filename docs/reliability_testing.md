# Reliability Testing

Goal: prove that **no wrong fact gets published**. Show the results in the demo.

## Test 1: Golden set (past games)
- Take last season's games (target 400).
- Run the full pipeline: fact sheet → LLM → checker.
- Measure: stories generated, passed first try, regenerated, sent to human, and **wrong facts that passed the checker** (target 0, verified by a manual sample of 50).
- Run: `pnpm --filter api reliability:golden`

## Test 2: Planted errors
- Take 50 correct stories and change one fact each (score, scorer, team, date, percentage).
- Measure: how many the checker catches (target 50/50).
- Run: `pnpm --filter api reliability:planted`

## Test 3: Model quality
- Back-test the prediction model on last season.
- Report: accuracy, Brier score, calibration buckets (50–60%, 60–70% ...). See `prediction_model.md`.
- Run: `pnpm --filter prediction_model backtest`

## Test 4: Video / recap timing (if clips are used)
- For each goal: compare the clip timestamp with the event timestamp. Pass if within ±10 s.
- Measure: % matched.

## Test 5: Human spot check (ongoing)
- Editors review a random 10% of green items daily.
- Track the published error rate, edit rate on yellow, and average review time (`GET /review/stats`).

## Results (fill in)
| Test | Result | Date |
|---|---|---|
| Golden set: wrong facts published | – / 400 | |
| Planted errors caught | – / 50 | |
| Model accuracy / Brier | – / – | |
| Clip timing match | – % | |
