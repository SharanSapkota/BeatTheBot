import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import type { LiigaClient } from "./liiga_client";
import {
  liiga_games_response_schema,
  liiga_players_response_schema,
  liiga_standings_response_schema,
  liiga_teams_response_schema,
  liiga_tournament_schema,
  type LiigaGame,
  type LiigaPlayer,
  type LiigaStandings,
  type LiigaTeam,
  type LiigaTournament,
} from "./liiga_schemas";

/** Saved real Liiga responses (apps/api/test/fixtures/liiga). */
export const DEFAULT_LIIGA_FIXTURE_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test/fixtures/liiga",
);

/** Reads saved Liiga responses from disk. Used by tests and to sync without network. */
export class FixtureLiigaClient implements LiigaClient {
  constructor(private readonly directory: string = DEFAULT_LIIGA_FIXTURE_DIRECTORY) {}

  get_tournament(): Promise<LiigaTournament> {
    return this.read_json("tournament.json", liiga_tournament_schema);
  }

  async get_teams(season: number): Promise<LiigaTeam[]> {
    const response = await this.read_json(
      `teams_${String(season)}.json`,
      liiga_teams_response_schema,
    );
    return response.teams;
  }

  async get_players(season: number): Promise<LiigaPlayer[]> {
    const response = await this.read_json(
      `players_${String(season)}.json`,
      liiga_players_response_schema,
    );
    return response.players;
  }

  async get_games(season: number): Promise<LiigaGame[]> {
    const response = await this.read_json(
      `games_${String(season)}.json`,
      liiga_games_response_schema,
    );
    return response.games;
  }

  /** The fixtures have no per-game files, so the game comes from the bulk file. */
  async get_game(season: number, game_id: number): Promise<LiigaGame> {
    const game = (await this.get_games(season)).find((candidate) => candidate.id === game_id);
    if (!game) {
      throw new Error(`Game ${String(game_id)} is not in the Liiga fixtures`);
    }
    return game;
  }

  get_standings(season: number): Promise<LiigaStandings> {
    return this.read_json(`standings_${String(season)}.json`, liiga_standings_response_schema);
  }

  private async read_json<T>(file_name: string, schema: z.ZodType<T>): Promise<T> {
    const text = await readFile(path.join(this.directory, file_name), "utf8");
    return schema.parse(JSON.parse(text));
  }
}
