import type {
  AdminLeague,
  AdminMatch,
  AdminMatchInput,
  AdminMatchResultInput,
  GameDetail,
  Sport,
} from "@voita_kone/shared_types";
import { SPORT_IDS, SPORTS } from "@voita_kone/scoring";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import type { GamesService } from "../games/games_service";
import { to_sport } from "../teams/teams_mapper";
import type { AdminMatchesRepository, MatchRow, MatchValues } from "./admin_matches_repository";
import {
  final_period,
  half_of,
  minute_to_seconds,
  result_rule_error,
  season_of,
} from "./match_rules";

/** Sports without a data API: an admin enters their matches. Hockey comes from the Liiga sync. */
export const ADMIN_SPORTS: readonly Sport[] = SPORT_IDS.filter((sport) => !SPORTS[sport].has_model);

/** Runs the idempotent scoring job after a result (jobs/score_predictions.ts). */
export interface ResultScorer {
  run(): Promise<unknown>;
}

function match_not_found(match_id: string): AppError {
  return new AppError("MATCH_NOT_FOUND", 404, `No match ${match_id}`);
}

function invalid_match(message: string): AppError {
  return new AppError("INVALID_MATCH", 400, message);
}

function to_admin_match(detail: GameDetail, pick_count: number): AdminMatch {
  const { events, demo_replay: _demo_replay, top_scorer, ...summary } = detail;
  return {
    ...summary,
    pick_count,
    goals: events
      .filter((event) => event.event_type === "goal" && event.team_id !== null)
      .map((event) => ({
        team_id: event.team_id ?? "",
        player: event.player,
        minute: Math.floor(event.game_time_seconds / 60) + 1,
      })),
    top_scorer,
  };
}

/**
 * /admin → Matches: football and basketball matches (league, home, away, start time) and their
 * results. Every change writes audit_log; a result scores the match's picks right away.
 */
export class AdminMatchesService {
  constructor(
    private readonly repository: AdminMatchesRepository,
    private readonly games_service: GamesService,
    private readonly scorer: ResultScorer,
    private readonly clock: Clock,
  ) {}

  async list_leagues(): Promise<AdminLeague[]> {
    const leagues = await this.repository.list_leagues();
    return leagues.map((league) => ({ ...league, sport: to_sport(league.sport) }));
  }

  /** Matches of one sport (or every admin sport), newest first. */
  async list_matches(sport: Sport | undefined): Promise<AdminMatch[]> {
    const ids = await this.repository.list_match_ids(sport ? [sport] : ADMIN_SPORTS);
    const picks = await this.repository.count_picks(ids);
    const details = await Promise.all(ids.map((id) => this.games_service.get_game_detail(id)));
    return details.map((detail) => to_admin_match(detail, picks.get(detail.id) ?? 0));
  }

  async create(actor_user_id: string, input: AdminMatchInput): Promise<AdminMatch> {
    const values = await this.validated_values(input);
    const id = await this.repository.create_match(values, {
      actor_user_id,
      action: "match.create",
      target_type: "match",
      details: { ...input },
      at: this.clock(),
    });
    return this.get(id);
  }

  async update(
    actor_user_id: string,
    match_id: string,
    input: AdminMatchInput,
  ): Promise<AdminMatch> {
    const match = await this.find_editable(match_id);
    if (match.status !== "scheduled") {
      throw new AppError("MATCH_LOCKED", 409, "Only a match that has not been played can change");
    }
    const values = await this.validated_values(input);
    const teams_changed =
      values.home_team_id !== match.home_team_id || values.away_team_id !== match.away_team_id;
    if (teams_changed && (await this.pick_count(match_id)) > 0) {
      throw new AppError("MATCH_HAS_PICKS", 409, "Fans have picked this match: keep its teams");
    }
    await this.repository.update_match(match_id, values, {
      actor_user_id,
      action: "match.update",
      target_type: "match",
      details: { ...input },
      at: this.clock(),
    });
    return this.get(match_id);
  }

  async delete(actor_user_id: string, match_id: string): Promise<void> {
    await this.find_editable(match_id);
    if ((await this.pick_count(match_id)) > 0) {
      throw new AppError(
        "MATCH_HAS_PICKS",
        409,
        "Fans have picked this match: it can't be deleted",
      );
    }
    await this.repository.delete_match(match_id, {
      actor_user_id,
      action: "match.delete",
      target_type: "match",
      at: this.clock(),
    });
  }

  /** Saves (or corrects) the result and scores every pick of the match. */
  async save_result(
    actor_user_id: string,
    match_id: string,
    result: AdminMatchResultInput,
  ): Promise<AdminMatch> {
    const match = await this.find_editable(match_id);
    if (this.clock() < match.start_time) {
      throw new AppError("MATCH_NOT_STARTED", 409, "Enter the result after the start time");
    }
    const sport = to_sport(match.sport);
    const player_ids = [
      ...result.goals.flatMap((goal) => (goal.player_id ? [goal.player_id] : [])),
      ...(result.top_scorer_player_id ? [result.top_scorer_player_id] : []),
    ];
    const player_teams = await this.repository.find_player_teams(player_ids);
    const error = result_rule_error(sport, match, result, player_teams);
    if (error !== null) {
      throw new AppError("INVALID_RESULT", 400, error);
    }
    await this.repository.save_result(
      match_id,
      {
        home_goals: result.home_goals,
        away_goals: result.away_goals,
        ended_in: result.ended_in,
        period: final_period(sport, result.ended_in),
        top_scorer_player_id: result.top_scorer_player_id,
        goals: [...result.goals]
          .sort((first, second) => first.minute - second.minute)
          .map((goal) => ({
            team_id: goal.team_id,
            player_id: goal.player_id,
            period: half_of(goal.minute),
            game_time_seconds: minute_to_seconds(goal.minute),
          })),
      },
      {
        actor_user_id,
        action: "match.result",
        target_type: "match",
        details: { ...result },
        at: this.clock(),
      },
    );
    await this.scorer.run();
    return this.get(match_id);
  }

  private async get(match_id: string): Promise<AdminMatch> {
    const detail = await this.games_service.get_game_detail(match_id);
    return to_admin_match(detail, await this.pick_count(match_id));
  }

  private async pick_count(match_id: string): Promise<number> {
    return (await this.repository.count_picks([match_id])).get(match_id) ?? 0;
  }

  /** Only football and basketball matches; Liiga games come from the sync. */
  private async find_editable(match_id: string): Promise<MatchRow> {
    const match = await this.repository.find_match(match_id);
    if (!match || !ADMIN_SPORTS.includes(to_sport(match.sport))) {
      throw match_not_found(match_id);
    }
    return match;
  }

  /** The league must be an admin league; both teams must play in it. */
  private async validated_values(input: AdminMatchInput): Promise<MatchValues> {
    const league = (await this.repository.list_leagues()).find(
      (candidate) => candidate.id === input.league_id,
    );
    if (!league) {
      throw invalid_match("Pick a football or basketball league");
    }
    const teams = await Promise.all([
      this.repository.find_team(input.home_team_id),
      this.repository.find_team(input.away_team_id),
    ]);
    if (teams.some((team) => team?.league_id !== league.id)) {
      throw invalid_match(`Both teams must play in ${league.name}`);
    }
    const sport = to_sport(league.sport);
    const start_time = new Date(input.start_time);
    return {
      sport,
      league_id: league.id,
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      start_time,
      season: season_of(sport, start_time),
    };
  }
}
