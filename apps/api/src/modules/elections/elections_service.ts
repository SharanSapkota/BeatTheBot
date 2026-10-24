import {
  ELECTION_RESULTS_LABEL,
  ELECTION_RESULTS_MIN_PICKS,
  type ElectionCandidate,
  type ElectionDetail,
  type ElectionLeaderboard,
  type ElectionList,
  type ElectionListQuery,
  type ElectionPick,
  type ElectionResults,
  type ElectionSummary,
} from "@voita_kone/shared_types";
import { ELECTION_POINTS } from "@voita_kone/scoring";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { TOP_ROW_COUNT, rank_entries } from "../leaderboard/leaderboard_builder";
import { order_candidates, order_seed } from "./candidate_order";
import { build_shares, results_hidden_reason } from "./election_results";
import { compare_for_list, is_poll_closed, is_poll_open } from "./election_rules";
import type {
  CandidateRow,
  ElectionRow,
  ElectionsRepository,
  PickRow,
} from "./elections_repository";

/** Users never see drafts. */
export const PUBLIC_STATUSES = ["published", "closed", "resulted"] as const;

export function election_not_found(election_id: string): AppError {
  return new AppError("ELECTION_NOT_FOUND", 404, `No election ${election_id}`);
}

export function invalid_candidate(): AppError {
  return new AppError("INVALID_CANDIDATE", 400, "Pick one of this election's candidates");
}

type Status = ElectionSummary["status"];

export function to_election_summary(row: ElectionRow, now: Date): ElectionSummary {
  return {
    id: row.id,
    title: row.title,
    election_type: row.election_type as ElectionSummary["election_type"],
    area_type: row.area_type as ElectionSummary["area_type"],
    area_name: row.area_name,
    election_date: row.election_date,
    poll_opens_at: row.poll_opens_at.toISOString(),
    poll_closes_at: row.poll_closes_at.toISOString(),
    status: row.status as Status,
    is_poll_open: is_poll_open(row, now),
    question_text: row.question_text,
    is_demo: row.is_demo,
    candidate_count: row.candidate_count,
  };
}

export function to_candidate(row: CandidateRow): ElectionCandidate {
  return {
    id: row.id,
    full_name: row.full_name,
    party_or_group: row.party_or_group,
    candidate_number: row.candidate_number,
    short_bio: row.short_bio,
    photo_url: row.photo_url,
  };
}

function to_pick(row: PickRow): ElectionPick {
  return {
    election_id: row.election_id,
    candidate_id: row.candidate_id,
    points_awarded: row.points_awarded,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/** Elections for users: list, candidates in the user's own order, picks, results, leaderboard. */
export class ElectionsService {
  constructor(
    private readonly repository: ElectionsRepository,
    private readonly clock: Clock,
  ) {}

  async list(query: ElectionListQuery): Promise<ElectionList> {
    const now = this.clock();
    const rows = await this.repository.list_elections(PUBLIC_STATUSES);
    const areas = [...new Set(rows.map((row) => row.area_name))].sort((first, second) =>
      first.localeCompare(second, "fi"),
    );
    const shown = rows
      .filter((row) => query.area === undefined || row.area_name === query.area)
      .filter((row) => query.status === undefined || row.status === query.status)
      .sort(compare_for_list(now));
    return { areas, elections: shown.map((row) => to_election_summary(row, now)) };
  }

  async get(election_id: string, user_id: string | null): Promise<ElectionDetail> {
    const election = await this.visible_election(election_id);
    const [candidates, pick, result] = await Promise.all([
      this.ordered_candidates(election_id, user_id),
      user_id === null ? undefined : this.repository.find_pick(user_id, election_id),
      this.repository.find_result(election_id),
    ]);
    return {
      ...to_election_summary(election, this.clock()),
      candidates: candidates.map(to_candidate),
      my_pick: pick
        ? { candidate_id: pick.candidate_id, points_awarded: pick.points_awarded }
        : null,
      winner_candidate_id: result?.winner_candidate_id ?? null,
    };
  }

  async create_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<ElectionPick> {
    await this.check_pick(election_id, candidate_id);
    const row = await this.repository.insert_pick(user_id, election_id, candidate_id);
    if (!row) {
      throw new AppError("PICK_EXISTS", 409, "You already picked. Use PUT to change your pick.");
    }
    return to_pick(row);
  }

  async update_pick(
    user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<ElectionPick> {
    await this.check_pick(election_id, candidate_id);
    const row = await this.repository.update_pick(user_id, election_id, candidate_id);
    if (!row) {
      throw new AppError("PICK_NOT_FOUND", 404, "You have no pick in this election yet");
    }
    return to_pick(row);
  }

  async results(election_id: string, user_id: string | null): Promise<ElectionResults> {
    const election = await this.visible_election(election_id);
    const [candidates, pick, counts, result] = await Promise.all([
      this.ordered_candidates(election_id, user_id),
      user_id === null ? undefined : this.repository.find_pick(user_id, election_id),
      this.repository.count_picks(election_id),
      this.repository.find_result(election_id),
    ]);
    const total_picks = [...counts.values()].reduce((sum, picks) => sum + picks, 0);
    const hidden_reason = results_hidden_reason({
      has_picked: pick !== undefined,
      is_poll_closed: is_poll_closed(election, this.clock()),
      total_picks,
    });
    return {
      election_id,
      total_picks,
      min_picks: ELECTION_RESULTS_MIN_PICKS,
      hidden_reason,
      shares:
        hidden_reason === null
          ? build_shares(
              candidates.map((candidate) => candidate.id),
              counts,
            )
          : null,
      winner_candidate_id: result?.winner_candidate_id ?? null,
      label_text: ELECTION_RESULTS_LABEL,
    };
  }

  /** Separate from the games leaderboard. Top 10 plus the user's own row. */
  async leaderboard(user_id: string | null): Promise<ElectionLeaderboard> {
    const [points, elections_count] = await Promise.all([
      this.repository.list_election_points(),
      this.repository.count_resulted_elections(),
    ]);
    const ranked = rank_entries(
      points.map((row) => ({
        id: row.user_id,
        display_name: row.display_name,
        points: row.points,
      })),
    );
    const shown = ranked.filter((entry, index) => index < TOP_ROW_COUNT || entry.id === user_id);
    return {
      elections_count,
      points_per_correct: ELECTION_POINTS,
      rows: shown.map((entry) => ({
        rank: entry.rank,
        kind: entry.id === user_id ? "you" : "user",
        display_name: entry.display_name,
        points: entry.points,
        movement: null,
      })),
    };
  }

  private async visible_election(election_id: string): Promise<ElectionRow> {
    const election = await this.repository.find_election(election_id);
    if (!election || !(PUBLIC_STATUSES as readonly string[]).includes(election.status)) {
      throw election_not_found(election_id);
    }
    return election;
  }

  private async ordered_candidates(election_id: string, user_id: string | null) {
    const candidates = await this.repository.list_candidates(election_id);
    return order_candidates(candidates, order_seed(user_id, election_id));
  }

  /** The poll must be open now (server clock) and the candidate must belong to the election. */
  private async check_pick(election_id: string, candidate_id: string): Promise<void> {
    const election = await this.visible_election(election_id);
    const now = this.clock();
    if (is_poll_closed(election, now)) {
      throw new AppError("POLL_CLOSED", 409, "Predictions for this election are closed");
    }
    if (!is_poll_open(election, now)) {
      throw new AppError("POLL_NOT_OPEN", 409, "Predictions for this election are not open yet");
    }
    const candidates = await this.repository.list_candidates(election_id);
    if (!candidates.some((candidate) => candidate.id === candidate_id)) {
      throw invalid_candidate();
    }
  }
}
