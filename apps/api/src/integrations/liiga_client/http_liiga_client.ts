import type { z } from "zod";
import { AppError } from "../../common/app_error";
import type { LiigaClient } from "./liiga_client";
import {
  liiga_game_detail_response_schema,
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

const REGULAR_SEASON = "runkosarja";
const DEFAULT_TIMEOUT_MS = 30_000;

export interface HttpLiigaClientOptions {
  base_url: string;
  /** Sent as the x-api-key header when not empty. Never logged. */
  api_key: string;
  timeout_ms?: number;
  fetch_fn?: typeof fetch;
}

export class HttpLiigaClient implements LiigaClient {
  private readonly base_url: string;
  private readonly api_key: string;
  private readonly timeout_ms: number;
  private readonly fetch_fn: typeof fetch;

  constructor(options: HttpLiigaClientOptions) {
    this.base_url = options.base_url.replace(/\/+$/, "");
    this.api_key = options.api_key;
    this.timeout_ms = options.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.fetch_fn = options.fetch_fn ?? fetch;
  }

  get_tournament(): Promise<LiigaTournament> {
    return this.get_json("/games/web/tournament", {}, liiga_tournament_schema);
  }

  async get_teams(season: number): Promise<LiigaTeam[]> {
    const response = await this.get_json(
      "/teams",
      { season: String(season) },
      liiga_teams_response_schema,
    );
    return response.teams;
  }

  async get_players(season: number): Promise<LiigaPlayer[]> {
    const response = await this.get_json(
      "/players",
      { season: String(season), serie: REGULAR_SEASON },
      liiga_players_response_schema,
    );
    return response.players;
  }

  async get_games(season: number): Promise<LiigaGame[]> {
    const response = await this.get_json(
      "/games",
      { season: String(season), serie: REGULAR_SEASON },
      liiga_games_response_schema,
    );
    return response.games;
  }

  async get_game(season: number, game_id: number): Promise<LiigaGame> {
    const response = await this.get_json(
      `/games/${String(season)}/${String(game_id)}`,
      {},
      liiga_game_detail_response_schema,
    );
    return response.game;
  }

  get_standings(season: number): Promise<LiigaStandings> {
    return this.get_json(
      `/standings/${REGULAR_SEASON}`,
      { season: String(season) },
      liiga_standings_response_schema,
    );
  }

  private async get_json<T>(
    path: string,
    query: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = new URL(`${this.base_url}/api/v1${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.api_key) {
      headers["x-api-key"] = this.api_key;
    }

    let response: Response;
    try {
      response = await this.fetch_fn(url, {
        headers,
        signal: AbortSignal.timeout(this.timeout_ms),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new AppError("LIIGA_API_UNAVAILABLE", 503, `Liiga API ${path} failed: ${reason}`);
    }
    if (!response.ok) {
      throw new AppError(
        "LIIGA_API_ERROR",
        502,
        `Liiga API ${path} answered ${String(response.status)}`,
      );
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new AppError(
        "LIIGA_API_INVALID_RESPONSE",
        502,
        `Liiga API ${path} returned an unexpected shape: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}
