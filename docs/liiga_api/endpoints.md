# Liiga stats API (v1): endpoints we use

Source: `openapi_v1.json` (downloaded from
`https://prod.liiga-backend.liiga.fi/stats/v3/api-docs/v1`, Swagger UI:
`/stats/swagger-ui/index.html?urls.primaryName=v1`). Checked 2026-10-24.

## Basics
| | |
|---|---|
| Base URL | `https://prod.liiga-backend.liiga.fi/stats` (`LIIGA_API_BASE_URL`), paths start with `/api/v1` |
| Auth | API key in the **`x-api-key` header** (security scheme `ApiKeyAuth`, applied to all endpoints). On 2026-10-24 the endpoints below also answered **without** a key; we send the header whenever `LIIGA_API_KEY` is set. |
| Rate limits | Not documented (no 429 or quota in the spec). Be polite: a full sync is ~4 requests. |
| Season | Integer **end year**: 2026-27 = `2027`. |
| Serie | Query value `runkosarja` = regular season (`playoffs` later). The schedule returns it as a number (`1188`). |
| IDs | Team: string `"495643563:kärpät"`. Player and game: integers. |
| Times | ISO 8601 UTC, e.g. `2026-10-23T15:30:00Z`. |
| Game time | `gameTime` = seconds since the start of the game (P2 05:12 = 1512). Overtime starts at 3600, shootout = 3900. |

## Endpoints

### Current season: `GET /api/v1/games/web/tournament`
```json
{ "season": 2027, "season_name": "2026-2027", "tournament_type": "RUNKOSARJA", "serie_start_date": "28.08", "serie_end_date": "23.03" }
```

### Teams: `GET /api/v1/teams?season=2027`
`{ "teams": [TeamDTO] }`. 17 teams.
```json
{ "id": "55786244:hpk", "nameAbbreviation": "HPK", "shortName": "HPK", "logos": { "darkBg": "https://…", "lightBg": "https://…" } }
```
No full name and no city. The display name (`"Kärpät"`, `"K-Espoo"`) comes from games/standings `teamName`; the city from the home games' `iceRink.city`.

### Players: `GET /api/v1/players?season=2027&serie=runkosarja`
`{ "players": [PlayerDTO] }`. 547 players. Per team: `GET /api/v1/players/{teamId}?season=2027`.
```json
{ "id": 23168071, "teamId": "495643563:kärpät", "firstName": "Tuomas", "lastName": "Salmela", "jersey": 61,
  "role": "DEFENSEMAN", "roleCode": "P", "dateOfBirth": "1995-06-30", "nationality": "FIN",
  "injured": false, "suspended": false, "removed": false }
```
`role`: `STRIKER` (forward), `DEFENSEMAN`, `GOALIE` (a few `null`). No centre/wing split. `dateOfBirth` is present for every player, so we have the birth year. 8 players have no jersey.

### Games with events (bulk): `GET /api/v1/games?season=2027&serie=runkosarja`
`{ "games": [GameDTO], "previousGameDate", "nextGameDate" }`. All 544 games in one call (~1.8 MB), **including goal and penalty events** for finished games. Filters: `teamId`, `date`, `fromDate`, `earlierThan`, `gameweek`, `limit`.
```json
{ "id": 2701405, "season": 2027, "start": "2026-10-23T15:30:00Z", "started": true, "ended": true,
  "finishedType": "ENDED_DURING_REGULAR_GAME_TIME", "serie": "RUNKOSARJA", "gameWeek": 9,
  "iceRink": { "name": "…", "city": "OULU" },
  "periods": [{ "index": 1, "category": "NORMAL", "homeTeamGoals": 1, "awayTeamGoals": 0 }],
  "homeTeam": { "teamId": "495643563:kärpät", "teamName": "Kärpät", "goals": 5,
    "goalEvents": [{ "eventId": 46, "scorerPlayerId": 61069904, "assistantPlayerIds": [25657580],
      "period": 1, "gameTime": 932, "goalTypes": [], "homeTeamScore": 1, "awayTeamScore": 0, "winningGoal": false }],
    "penaltyEvents": [{ "eventId": 75, "playerId": 32269686, "period": 2, "gameTime": 1448,
      "penaltyMinutes": 2, "penaltyFaultName": "Kiinnipitäminen", "penaltyFaultType": "KII" }] },
  "awayTeam": { "…": "same shape" },
  "winningShotCompetitionEvents": [{ "shootingPlayerId": 1, "shootingTeamId": "…", "goalScored": true, "winningGoal": false }] }
```
- `finishedType`: `ACTIVE_OR_NOT_STARTED` | `ENDED_DURING_REGULAR_GAME_TIME` | `ENDED_DURING_EXTENDED_GAME_TIME` (overtime) | `ENDED_DURING_WINNING_SHOT_COMPETITION` (shootout) | `CANCELLED`.
- `goalTypes` codes seen: `YV` power play, `TM` empty net, `VT` video-reviewed goal (counts), `VL` shootout winner (period 5, gameTime 3900).
- **Not goals:** `VT0` = goal disallowed after video review (scorerPlayerId `0`), `RL0` = missed penalty shot (shooter set, score unchanged). With these two excluded, goal events match the final score in all 262 team-games of 2026-27 so far.
- The final score includes the overtime/shootout winning goal, so a final is never tied.
- Optional fields really are optional: `winningShotCompetitionEvents` and `scorerPlayer` can be missing or `null`.

### Game details: `GET /api/v1/games/{season}/{gameId}`
`{ game: GameDTO, awards, homeTeamPlayers: [PlayerDTO], awayTeamPlayers: [PlayerDTO] }`. Same events as the bulk call plus the game-day roster (with `line`). Use for one game, or for a player missing from `/players`.

### Standings: `GET /api/v1/standings/runkosarja?season=2027`
`{ "items": [StandingsItemDTO], "playoffsLines": [4, 12, 14], "cacheUpdateDate" }`
```json
{ "teamId": "495643563:kärpät", "teamName": "Kärpät", "ranking": 5, "games": 17, "wins": 6, "overtimeWins": 4,
  "overtimeLosses": 4, "losses": 3, "points": 30, "goals": 50, "goalsAgainst": 45 }
```
`wins` = regulation wins. Lets us cross-check our own points calculation.

### Player stats
- Season totals: `GET /api/v1/player-point-table/runkosarja?season=2027` → `{ "playerPointTable": [{ playerId, teamId, games, goals, assists, points, goalsPerGame, winningGoals, … }] }`.
- Per game: derive goals and assists from the goal events (no extra call), or `GET /api/v1/games/{season}/{gameId}/playersWithStats`.

### Not used now (later candidates)
`/games/{season}/{gameId}/pastAndFutureGames` (head-to-head), `/team-comparison/beforegame/…`, `/games/{season}/{gameId}/playersToWatch`, `/player/penalties`, `/player/suspensions`, `/games/schedule` (a lighter list without events).
