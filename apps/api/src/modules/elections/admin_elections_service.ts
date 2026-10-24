import type {
  AdminCandidateRequest,
  AdminElection,
  AdminElectionRequest,
  AdminResultRequest,
} from "@voita_kone/shared_types";
import { score_election_pick } from "@voita_kone/scoring";
import { z } from "zod";
import { AppError } from "../../common/app_error";
import type { Clock } from "../../common/clock";
import { default_question, is_poll_closed, poll_window_problem } from "./election_rules";
import type {
  CandidateRow,
  ElectionRow,
  ElectionValues,
  ElectionsRepository,
} from "./elections_repository";
import {
  election_not_found,
  invalid_candidate,
  to_candidate,
  to_election_summary,
} from "./elections_service";

export const MIN_CANDIDATES = 2;

const vote_counts_schema = z.record(z.string(), z.number());

function validation_error(message: string): AppError {
  return new AppError("VALIDATION_ERROR", 400, message);
}

function election_locked(action: string, status: string): AppError {
  return new AppError("ELECTION_LOCKED", 409, `Can't ${action} an election that is ${status}`);
}

function candidate_not_found(candidate_id: string): AppError {
  return new AppError("CANDIDATE_NOT_FOUND", 404, `No candidate ${candidate_id}`);
}

function to_values(request: AdminElectionRequest): ElectionValues {
  const values: ElectionValues = {
    title: request.title,
    election_type: request.election_type,
    area_type: request.area_type,
    area_name: request.area_name,
    election_date: request.election_date,
    poll_opens_at: new Date(request.poll_opens_at),
    poll_closes_at: new Date(request.poll_closes_at),
    question_text: request.question_text ?? default_question(request.area_name),
    is_demo: request.is_demo,
  };
  const problem = poll_window_problem(values);
  if (problem) {
    throw validation_error(problem);
  }
  return values;
}

/** Admin tab "Elections": every change writes audit_log in the same transaction. */
export class AdminElectionsService {
  constructor(
    private readonly repository: ElectionsRepository,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<AdminElection[]> {
    const rows = await this.repository.list_elections(["draft", "published", "closed", "resulted"]);
    return Promise.all(rows.map((row) => this.to_admin_election(row)));
  }

  async get(election_id: string): Promise<AdminElection> {
    return this.to_admin_election(await this.election(election_id));
  }

  async create(actor_user_id: string, request: AdminElectionRequest): Promise<AdminElection> {
    const values = to_values(request);
    const election_id = await this.repository.create_election(values, actor_user_id, {
      ...this.audit(actor_user_id, "election.create", "election"),
      details: { title: values.title, area_name: values.area_name },
    });
    return this.get(election_id);
  }

  async update(
    actor_user_id: string,
    election_id: string,
    request: AdminElectionRequest,
  ): Promise<AdminElection> {
    const election = await this.editable(election_id, "edit", ["draft", "published"]);
    const values = to_values(request);
    await this.repository.update_election(election.id, values, {
      ...this.audit(actor_user_id, "election.update", "election"),
      details: { before: { title: election.title, area_name: election.area_name }, after: values },
    });
    return this.get(election_id);
  }

  async delete(actor_user_id: string, election_id: string): Promise<void> {
    const election = await this.editable(election_id, "delete", ["draft"]);
    await this.repository.delete_election(election.id, {
      ...this.audit(actor_user_id, "election.delete", "election"),
      details: { title: election.title },
    });
  }

  async add_candidate(
    actor_user_id: string,
    election_id: string,
    request: AdminCandidateRequest,
  ): Promise<AdminElection> {
    await this.editable(election_id, "add candidates to", ["draft", "published"]);
    await this.repository.create_candidate(election_id, request, {
      ...this.audit(actor_user_id, "candidate.create", "election_candidate"),
      details: { election_id, full_name: request.full_name },
    });
    return this.get(election_id);
  }

  async update_candidate(
    actor_user_id: string,
    election_id: string,
    candidate_id: string,
    request: AdminCandidateRequest,
  ): Promise<AdminElection> {
    await this.editable(election_id, "edit candidates of", ["draft", "published"]);
    const candidate = await this.candidate(election_id, candidate_id);
    await this.repository.update_candidate(candidate_id, request, {
      ...this.audit(actor_user_id, "candidate.update", "election_candidate"),
      details: { election_id, before: to_candidate(candidate), after: request },
    });
    return this.get(election_id);
  }

  async delete_candidate(
    actor_user_id: string,
    election_id: string,
    candidate_id: string,
  ): Promise<AdminElection> {
    // Picks point at candidates, so candidates are removed only before publishing.
    await this.editable(election_id, "remove candidates from", ["draft"]);
    const candidate = await this.candidate(election_id, candidate_id);
    await this.repository.delete_candidate(candidate_id, {
      ...this.audit(actor_user_id, "candidate.delete", "election_candidate"),
      details: { election_id, full_name: candidate.full_name },
    });
    return this.get(election_id);
  }

  async publish(actor_user_id: string, election_id: string): Promise<AdminElection> {
    const election = await this.editable(election_id, "publish", ["draft"]);
    if (election.candidate_count < MIN_CANDIDATES) {
      throw new AppError(
        "TOO_FEW_CANDIDATES",
        409,
        `An election needs at least ${String(MIN_CANDIDATES)} candidates`,
      );
    }
    await this.repository.set_status(
      election_id,
      "published",
      undefined,
      this.audit(actor_user_id, "election.publish", "election"),
    );
    return this.get(election_id);
  }

  async close(actor_user_id: string, election_id: string): Promise<AdminElection> {
    const election = await this.editable(election_id, "close", ["published"]);
    const now = this.clock();
    // An early close ends the poll now, so "poll closed" means the same everywhere.
    const closes_early = now < election.poll_closes_at && now > election.poll_opens_at;
    await this.repository.set_status(election_id, "closed", closes_early ? now : undefined, {
      ...this.audit(actor_user_id, "election.close", "election"),
      details: { poll_closes_at: (closes_early ? now : election.poll_closes_at).toISOString() },
    });
    return this.get(election_id);
  }

  /** Enters (or corrects) the result and scores every pick: 20 for the winner, else 0. */
  async enter_result(
    actor_user_id: string,
    election_id: string,
    request: AdminResultRequest,
  ): Promise<AdminElection> {
    const election = await this.election(election_id);
    if (election.status === "draft") {
      throw election_locked("enter the result of", election.status);
    }
    if (!is_poll_closed(election, this.clock())) {
      throw new AppError("POLL_NOT_CLOSED", 409, "Close the poll before entering the result");
    }
    const candidates = await this.repository.list_candidates(election_id);
    const candidate_ids = new Set(candidates.map((candidate) => candidate.id));
    if (!candidate_ids.has(request.winner_candidate_id)) {
      throw invalid_candidate();
    }
    if (
      request.vote_counts &&
      Object.keys(request.vote_counts).some((id) => !candidate_ids.has(id))
    ) {
      throw invalid_candidate();
    }
    const points_by_candidate = new Map(
      candidates.map((candidate) => [
        candidate.id,
        score_election_pick(candidate.id, request.winner_candidate_id),
      ]),
    );
    await this.repository.save_result(
      election_id,
      {
        winner_candidate_id: request.winner_candidate_id,
        vote_counts: request.vote_counts,
        entered_by: actor_user_id,
        entered_at: this.clock(),
        points_by_candidate,
      },
      {
        ...this.audit(actor_user_id, "election.result", "election"),
        details: {
          winner_candidate_id: request.winner_candidate_id,
          vote_counts: request.vote_counts,
          correction: election.status === "resulted",
        },
      },
    );
    return this.get(election_id);
  }

  private audit(actor_user_id: string, action: string, target_type: string) {
    return { actor_user_id, action, target_type, at: this.clock() };
  }

  private async election(election_id: string): Promise<ElectionRow> {
    const election = await this.repository.find_election(election_id);
    if (!election) {
      throw election_not_found(election_id);
    }
    return election;
  }

  private async editable(
    election_id: string,
    action: string,
    statuses: readonly string[],
  ): Promise<ElectionRow> {
    const election = await this.election(election_id);
    if (!statuses.includes(election.status)) {
      throw election_locked(action, election.status);
    }
    return election;
  }

  private async candidate(election_id: string, candidate_id: string): Promise<CandidateRow> {
    const candidates = await this.repository.list_candidates(election_id);
    const candidate = candidates.find((row) => row.id === candidate_id);
    if (!candidate) {
      throw candidate_not_found(candidate_id);
    }
    return candidate;
  }

  private async to_admin_election(row: ElectionRow): Promise<AdminElection> {
    const [candidates, counts, result] = await Promise.all([
      this.repository.list_candidates(row.id),
      this.repository.count_picks(row.id),
      this.repository.find_result(row.id),
    ]);
    const parsed_counts = vote_counts_schema.safeParse(result?.vote_counts);
    return {
      ...to_election_summary(row, this.clock()),
      candidates: candidates.map(to_candidate),
      pick_count: [...counts.values()].reduce((sum, picks) => sum + picks, 0),
      result: result
        ? {
            winner_candidate_id: result.winner_candidate_id,
            vote_counts: parsed_counts.success ? parsed_counts.data : null,
            entered_at: result.entered_at.toISOString(),
          }
        : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
