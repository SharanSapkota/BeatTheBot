# Prediction Model (simple version)

Lives in `packages/prediction_model`. Pure functions, no DB, no network. Fully unit tested.

## Terms
- **Team strength**: how good a team is at scoring (attack) and stopping goals (defence), compared to the league average.
- **Poisson distribution**: a standard way to model "how many times something happens" (goals in a game). If we expect 3.1 goals, Poisson tells us the chance of 0, 1, 2, 3 ... goals.
- **Monte Carlo simulation**: play the rest of the season thousands of times with random results based on the probabilities, then count how often each outcome happens (e.g. relegated in 2,100 of 10,000 runs = 21%).
- **Home advantage**: home teams score a bit more on average. We measure it from the data.
- **Calibration**: when the model says 60%, does it happen about 60% of the time?
- **Brier score**: one number for prediction quality (0 = perfect, lower is better). It is the average of (probability − actual result)².

## Steps
1. **Expected goals per game**
   `home_expected = league_avg × home_attack × away_defence × home_advantage`
   `away_expected = league_avg × away_attack × home_defence`
   Strengths come from recent games, weighting the last 10 games more.
2. **Game probabilities**: use Poisson for each team's goals to get home win / draw after 60 min / away win. A draw goes to overtime (≈50/50 for the MVP).
3. **Liiga points**: regulation win 3, OT/SO win 2, OT/SO loss 1, regulation loss 0.
4. **Season simulation**: simulate all remaining games 10,000 times, rank the table each time, then count playoff and relegation finishes per team.
5. **Stakes for one game**: run the simulation twice, with the game forced to a home win and to an away win. The difference = what's at stake.
6. **Top scorer pick**: the player with the highest recent goals-per-game on the predicted winner (MVP rule).

## Output → `ai_predictions` / `team_season_odds`
Every reason shown to users must point to a `fact_id` in the fact sheet.

## Quality checks
- Back-test on last season: Brier score and calibration table.
- Use a fixed random seed in tests so results are repeatable.
