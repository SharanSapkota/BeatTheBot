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
- Run: `pnpm --filter prediction_model backtest` (reads the Liiga API through the api's `LiigaClient`, stores nothing).

### Results, 2026-10-24 (model `poisson_mc_v1`)
Walk-forward: every game is predicted only from games that started before it. Games where a team had played fewer than 3 games are skipped. Baseline = always pick the home team, with the league's home-win rate so far as the probability.

**Liiga 2025-26 (complete season, 16 teams, 480 games)**

| Metric | Model | Baseline (always home) |
|---|---|---|
| Games predicted | 453 (27 skipped) | |
| Winner accuracy | **63.1%** | 55.0% |
| Brier score (lower is better) | **0.2350** | 0.2472 |
| Exact 60-min score right | 2.9% | |
| Games to overtime: predicted / actual | 16.6% / 22.3% | |

| AI's probability for its pick | Games | Average predicted | Actually won |
|---|---|---|---|
| 50–60% | 233 | 55.0% | 61.8% |
| 60–70% | 146 | 64.4% | 62.3% |
| 70–80% | 66 | 74.5% | 68.2% |
| 80–90% | 8 | 82.6% | 75.0% |
| 90–100% | 0 | – | – |

**Liiga 2026-27 (games played so far, 17 teams)**

| Metric | Model | Baseline (always home) |
|---|---|---|
| Games predicted | 102 (29 skipped) | |
| Winner accuracy | 55.9% | 57.8% |
| Brier score | **0.2388** | 0.2493 |
| Exact 60-min score right | 3.9% | |
| Games to overtime: predicted / actual | 17.0% / 23.5% | |

| AI's probability for its pick | Games | Average predicted | Actually won |
|---|---|---|---|
| 50–60% | 49 | 55.8% | 42.9% |
| 60–70% | 37 | 64.5% | 62.2% |
| 70–80% | 14 | 74.5% | 78.6% |
| 80–90% | 2 | 80.8% | 100.0% |

**What this says (honestly)**
- On a full season the model picks the winner 63% of the time and beats "always home" on accuracy and Brier score. Normal for hockey, where one game is very random.
- This season's sample is small (102 games): accuracy is below the home baseline so far, but the Brier score is better, so the probabilities are still more useful than "home always wins".
- Overtime is under-predicted (≈17% vs ≈23%): independent Poisson goals give too few ties.
- Slightly over-confident above 70% (2025-26: 74.5% predicted, 68.2% won). Season odds near 0% / 100% are likely over-confident too, because team strengths are treated as exactly known in the simulation.

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
| Model accuracy / Brier (2025-26) | 63.1% / 0.2350 (baseline 55.0% / 0.2472) | 2026-10-24 |
| Clip timing match | – % | |
