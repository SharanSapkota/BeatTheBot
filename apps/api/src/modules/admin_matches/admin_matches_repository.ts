import { randomUUID } from "node:crypto";
import type { Sport } from "@voita_kone/shared_types";
import { sql } from "kysely";
import { write_audit, type AuditEntry } from "../../db/audit_log";
import type { Database } from "../../db/kysely";

/** The audit entry of a change; target_id defaults to the changed match. */
export type MatchAudit = Omit<AuditEntry, "target_id"> & { target_id?: string | null };

export interface AdminLeagueRow {
  id: string;
  name: string;
  sport: string;
  country: string;
  teams: { id: string; name: string; short_name: string }[];
}

export interface MatchRow {
  id: string;
  sport: string;
  league_id: string;
  data_source: string;
  status: string;
  start_time: Date;
  home_team_id: string;
  away_team_id: string;
}

export interface MatchValues {
  sport: Sport;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  start_time: Date;
  season: string;
}

export interface MatchGoalValues {
  team_id: string;
  player_id: string | null;
  period: number;
  game_time_seconds: number;
}

export interface MatchResultValues {
  home_goals: number;
  away_goals: number;
  ended_in: string;
  period: number;
  top_scorer_player_id: string | null;
  goals: readonly MatchGoalValues[];
}

export interface AdminMatchesRepository {
  /** Leagues without a data API (not hockey), with their teams by name. */
  list_leagues(): Promise<AdminLeagueRow[]>;
  find_team(team_id: string): Promise<{ id: string; league_id: string } | undefined>;
  /** Matches of these sports, newest first. */
  list_match_ids(sports: readonly Sport[]): Promise<string[]>;
  find_match(match_id: string): Promise<MatchRow | undefined>;
  count_picks(match_ids: readonly string[]): Promise<Map<string, number>>;
  /** The team of each player (unknown players are left out). */
  find_player_teams(player_ids: readonly string[]): Promise<Map<string, string>>;
  create_match(values: MatchValues, audit: MatchAudit): Promise<string>;
  update_match(match_id: string, values: MatchValues, audit: MatchAudit): Promise<void>;
  delete_match(match_id: string, audit: MatchAudit): Promise<void>;
  /**
   * Saves the result in one transaction: the score, goal events (replaced), the top scorer,
   * status final, and the match's picks marked unscored so the scoring job scores them again.
   */
  save_result(match_id: string, result: MatchResultValues, audit: MatchAudit): Promise<void>;
}

export class KyselyAdminMatchesRepository implements AdminMatchesRepository {
  constructor(private readonly db: Database) {}

  async list_leagues(): Promise<AdminLeagueRow[]> {
    const leagues = await this.db
      .selectFrom("leagues")
      .select(["id", "name", "sport", "country"])
      .where("sport", "<>", "hockey")
      .orderBy("sport")
      .orderBy("name")
      .execute();
    const teams = await this.db
      .selectFrom("teams")
      .select(["id", "name", "short_name", "league_id"])
      .where("sport", "<>", "hockey")
      .execute();
    return leagues.map((league) => ({
      ...league,
      teams: teams
        .filter((team) => team.league_id === league.id)
        .map(({ id, name, short_name }) => ({ id, name, short_name }))
        .sort((first, second) => first.name.localeCompare(second.name, "fi")),
    }));
  }

  find_team(team_id: string): Promise<{ id: string; league_id: string } | undefined> {
    return this.db
      .selectFrom("teams")
      .select(["id", "league_id"])
      .where("id", "=", team_id)
      .executeTakeFirst();
  }

  async list_match_ids(sports: readonly Sport[]): Promise<string[]> {
    if (sports.length === 0) {
      return [];
    }
    const rows = await this.db
      .selectFrom("games")
      .select("id")
      .where("sport", "in", sports)
      .orderBy("start_time", "desc")
      .orderBy("id")
      .execute();
    return rows.map((row) => row.id);
  }

  find_match(match_id: string): Promise<MatchRow | undefined> {
    return this.db
      .selectFrom("games")
      .select([
        "id",
        "sport",
        "league_id",
        "data_source",
        "status",
        "start_time",
        "home_team_id",
        "away_team_id",
      ])
      .where("id", "=", match_id)
      .executeTakeFirst();
  }

  async count_picks(match_ids: readonly string[]): Promise<Map<string, number>> {
    if (match_ids.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .selectFrom("user_predictions")
      .select(["game_id", sql<number>`count(*)::int`.as("pick_count")])
      .where("game_id", "in", match_ids)
      .groupBy("game_id")
      .execute();
    return new Map(rows.map((row) => [row.game_id, row.pick_count]));
  }

  async find_player_teams(player_ids: readonly string[]): Promise<Map<string, string>> {
    if (player_ids.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .selectFrom("players")
      .select(["id", "team_id"])
      .where("id", "in", player_ids)
      .execute();
    return new Map(rows.map((row) => [row.id, row.team_id]));
  }

  create_match(values: MatchValues, audit: MatchAudit): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto("games")
        .values({ ...values, external_id: `admin:${randomUUID()}`, data_source: "admin" })
        .returning("id")
        .executeTakeFirstOrThrow();
      await write_audit(trx, { ...audit, target_id: audit.target_id ?? id });
      return id;
    });
  }

  async update_match(match_id: string, values: MatchValues, audit: MatchAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable("games").set(values).where("id", "=", match_id).execute();
      await write_audit(trx, { ...audit, target_id: audit.target_id ?? match_id });
    });
  }

  async delete_match(match_id: string, audit: MatchAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("games").where("id", "=", match_id).execute();
      await write_audit(trx, { ...audit, target_id: audit.target_id ?? match_id });
    });
  }

  async save_result(match_id: string, result: MatchResultValues, audit: MatchAudit): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const game = await trx
        .updateTable("games")
        .set({
          status: "final",
          home_goals: result.home_goals,
          away_goals: result.away_goals,
          ended_in: result.ended_in,
          period: result.period,
          game_clock_seconds: null,
          top_scorer_player_id: result.top_scorer_player_id,
        })
        .where("id", "=", match_id)
        .returning("data_source")
        .executeTakeFirstOrThrow();
      await trx.deleteFrom("game_events").where("game_id", "=", match_id).execute();
      if (result.goals.length > 0) {
        await trx
          .insertInto("game_events")
          .values(
            result.goals.map((goal) => ({
              ...goal,
              game_id: match_id,
              event_type: "goal",
              data_source: game.data_source,
            })),
          )
          .execute();
      }
      // A corrected result re-scores every pick (the scoring job is idempotent).
      await trx
        .updateTable("user_predictions")
        .set({ scored_at: null, points_awarded: null })
        .where("game_id", "=", match_id)
        .execute();
      await write_audit(trx, { ...audit, target_id: audit.target_id ?? match_id });
    });
  }
}
