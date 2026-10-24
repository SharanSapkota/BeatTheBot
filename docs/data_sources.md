# Data Sources

## Liiga API (provided by Kaleva)
- Access: API key from Kaleva → `LIIGA_API_KEY` in `.env`, sent as the `x-api-key` header. **Never commit or log the key.** On 2026-10-24 the endpoints also answered without a key.
- Base URL: `LIIGA_API_BASE_URL=https://prod.liiga-backend.liiga.fi/stats`. Full details and example responses: [liiga_api/endpoints.md](liiga_api/endpoints.md). Spec: [liiga_api/openapi_v1.json](liiga_api/openapi_v1.json).
- Season id = end year (2026-27 → `2027`), serie `runkosarja` = regular season.

| Need | Endpoint | Notes |
|---|---|---|
| Current season | `GET /api/v1/games/web/tournament` | `{ season: 2027, season_name: "2026-2027" }` |
| Teams | `GET /api/v1/teams?season=2027` | id, abbreviation, logos only. Name from games/standings `teamName`, city from home `iceRink.city` |
| Players / rosters | `GET /api/v1/players?season=2027&serie=runkosarja` | `dateOfBirth` for all players (birth year ✅). Role: forward/defense/goalie only |
| Schedule + results | `GET /api/v1/games?season=2027&serie=runkosarja` | all 544 games in one call, with events |
| Game events (goals, assists, penalties) | included in the call above; one game: `GET /api/v1/games/{season}/{gameId}` | `gameTime` = seconds since game start. Ignore `VT0` (disallowed) and `RL0` (missed penalty shot) events |
| Standings | `GET /api/v1/standings/runkosarja?season=2027` | ranking, W / OTW / OTL / L, points, goals |
| Player stats per game | derived from goal events; or `GET /api/v1/games/{season}/{gameId}/playersWithStats` | season totals: `GET /api/v1/player-point-table/runkosarja?season=2027` |

- Rate limits: not documented. A full sync is 5 requests (tournament, teams, players, games, standings).
- Offline: no response cache. `FixtureLiigaClient` reads saved real responses from `apps/api/test/fixtures/liiga/` (used by tests, by `--fixtures`, and as the seed's fallback when the API can't be reached).
- The bulk games call has goal events but **no penalty events** for 2026-27 (checked 2026-10-24); penalties need the per-game call.
- `/players` lists a player who changed teams once per team (2 players on 2026-10-24). The mapper keeps one entry: an active one over a removed one, otherwise the last one.

## Rules for using the data
- The `liiga_client` is the **only** place that calls the API. Everything else reads from our DB.
- Map API fields to our `data_model.md` names in one mapper file (`liiga_mapper.ts`) with tests.
- Store `external_id` for every row so syncs are idempotent (upsert, no duplicates).
- If the API changes or is down, the app keeps working on the last synced data.
- Every sports row has `data_source` (`liiga_api` | `demo`). Sync upserts only `liiga_api` rows and never changes or deletes `demo` rows.
- Demo fill-ins (`db:seed`): only when today has no real game in a hub state (upcoming / live / final), a `demo_<state>` game is created between real teams that are free today, with real forwards as scorers.

## Season facts used by the model
- Liiga 2026/27: 17 teams (one-off "superseason"), 3 relegated, league goes to 14 teams afterwards.
- Points: regulation win 3, OT/SO win 2, OT/SO loss 1, regulation loss 0.
- Keep these in `packages/prediction_model/src/season_config.ts`, not hardcoded in logic.

## Other data (later)
- Kaleva RSS: link related human-written articles under the widget.
- Video clips: only with permission from Kaleva / rights holder (see `editorial_rules.md`).
