# Data Sources

## Liiga API (provided by Kaleva)
- Access: API key from Kaleva → `LIIGA_API_KEY` in `.env`. **Never commit the key.**
- Fill in when known:

| Need | Endpoint | Notes |
|---|---|---|
| Teams | `TODO` | |
| Players / rosters | `TODO` | birth year needed for the minors rule |
| Schedule + results | `TODO` | |
| Game events (goals, assists, penalties) | `TODO` | time format? |
| Standings | `TODO` | |
| Player stats per game | `TODO` | needed for top-scorer pick |

- Rate limits: `TODO`. The sync job caches raw responses in `game_events.raw` / local files to avoid repeat calls.

## Rules for using the data
- The `liiga_client` is the **only** place that calls the API. Everything else reads from our DB.
- Map API fields to our `data_model.md` names in one mapper file (`liiga_mapper.ts`) with tests.
- Store `external_id` for every row so syncs are idempotent (upsert, no duplicates).
- If the API changes or is down, the app keeps working on the last synced data.

## Season facts used by the model
- Liiga 2026/27: 17 teams (one-off "superseason"), 3 relegated, league goes to 14 teams afterwards.
- Points: regulation win 3, OT/SO win 2, OT/SO loss 1, regulation loss 0.
- Keep these in `packages/prediction_model/src/season_config.ts`, not hardcoded in logic.

## Other data (later)
- Kaleva RSS: link related human-written articles under the widget.
- Video clips: only with permission from Kaleva / rights holder (see `editorial_rules.md`).
