import type {
  LiigaGame,
  LiigaPlayer,
  LiigaStandings,
  LiigaTeam,
  LiigaTournament,
} from "./liiga_schemas";

/**
 * The only way the app reads the Liiga API. `season` is the Liiga season id,
 * the end year of the season (2026-27 = 2027). All calls use the regular season.
 */
export interface LiigaClient {
  get_tournament(): Promise<LiigaTournament>;
  get_teams(season: number): Promise<LiigaTeam[]>;
  get_players(season: number): Promise<LiigaPlayer[]>;
  /** All games of the season, with goal and penalty events. */
  get_games(season: number): Promise<LiigaGame[]>;
  /** One game with all its events (including penalties). */
  get_game(season: number, game_id: number): Promise<LiigaGame>;
  get_standings(season: number): Promise<LiigaStandings>;
}
